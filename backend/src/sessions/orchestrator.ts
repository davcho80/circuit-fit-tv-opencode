// ============================================================
// Orchestrateur de sessions d'entraînement
// ------------------------------------------------------------
// Gère le cycle de vie d'une session active :
//   - construction de la liste ordonnée des phases
//   - timer (setTimeout) pour avancer automatiquement
//   - diffusion WebSocket à chaque changement d'état
// ============================================================

import { hub } from '../ws/hub.js';
import { prisma } from '../db.js';
import { buildPhases, type Phase } from './phase-plan.js';

interface ActiveSession {
  sessionId: string;
  circuitId: string;
  phases: Phase[];
  totalRounds: number;
  currentPhaseIdx: number;
  phaseStartsAt: number;
  phaseEndsAt: number;
  pausedAt: number | null;
  remainingOnPauseMs: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  hydrationBreakEndsAt: number | null;
  hydrationBreakTimer: ReturnType<typeof setTimeout> | null;
}

class SessionOrchestrator {
  private active: ActiveSession | null = null;

  async start(circuitId: string): Promise<string> {
    if (this.active) await this.abort();

    const circuit = await prisma.circuit.findUniqueOrThrow({
      where: { id: circuitId },
      include: {
        stations: {
          orderBy: { position: 'asc' },
          include: { exercises: { include: { exercise: true } } },
        },
        scheduledBreaks: { orderBy: { afterRound: 'asc' } },
      },
    });

    const phases = buildPhases(circuit);

    const session = await prisma.session.create({
      data: {
        circuitId,
        status: 'RUNNING',
        currentRound: phases[0]?.round ?? 1,
        currentPhase: phases[0]?.type ?? 'TRANSITION',
        currentStationIdx: phases[0]?.stationIdx ?? 0,
      },
    });

    const now = Date.now();
    const firstPhase = phases[0];
    if (!firstPhase) throw new Error('Circuit has no phases');

    this.active = {
      sessionId: session.id,
      circuitId,
      phases,
      totalRounds: circuit.rounds,
      currentPhaseIdx: 0,
      phaseStartsAt: now,
      phaseEndsAt: now + firstPhase.durationMs,
      pausedAt: null,
      remainingOnPauseMs: null,
      timer: null,
      hydrationBreakEndsAt: null,
      hydrationBreakTimer: null,
    };

    this.scheduleNext(firstPhase.durationMs);
    this.broadcastSessionUpdate();

    return session.id;
  }

  pause(): void {
    if (!this.active || this.active.pausedAt !== null) return;

    this.clearTimer(this.active.timer);
    this.active.timer = null;
    this.active.pausedAt = Date.now();
    this.active.remainingOnPauseMs = Math.max(0, this.active.phaseEndsAt - this.active.pausedAt);

    prisma.session.update({
      where: { id: this.active.sessionId },
      data: { status: 'PAUSED', pausedAt: new Date(this.active.pausedAt), remainingOnPauseMs: this.active.remainingOnPauseMs },
    }).catch((_err) => console.warn('Failed to pause session:', _err));

    this.broadcastSessionUpdate();
  }

  resume(): void {
    if (!this.active || this.active.pausedAt === null) return;

    this.clearTimer(this.active.hydrationBreakTimer);
    this.active.hydrationBreakTimer = null;
    this.active.hydrationBreakEndsAt = null;

    const remaining = this.active.remainingOnPauseMs ?? 0;
    const now = Date.now();
    this.active.phaseStartsAt = now;
    this.active.phaseEndsAt = now + remaining;
    this.active.pausedAt = null;
    this.active.remainingOnPauseMs = null;

    prisma.session.update({
      where: { id: this.active.sessionId },
      data: { status: 'RUNNING', pausedAt: null, remainingOnPauseMs: null },
    }).catch((_err) => console.warn('Failed to resume session:', _err));

    this.scheduleNext(remaining);
    this.broadcastSessionUpdate();
  }

  hydrationBreak(durationMs: number): void {
    if (!this.active) return;

    this.clearTimer(this.active.hydrationBreakTimer);
    this.active.hydrationBreakTimer = null;

    if (this.active.pausedAt === null) {
      this.clearTimer(this.active.timer);
      this.active.timer = null;
      this.active.pausedAt = Date.now();
      this.active.remainingOnPauseMs = Math.max(0, this.active.phaseEndsAt - this.active.pausedAt);
      prisma.session.update({
        where: { id: this.active.sessionId },
        data: { status: 'PAUSED', pausedAt: new Date(this.active.pausedAt), remainingOnPauseMs: this.active.remainingOnPauseMs },
      }).catch((_err) => console.warn('Failed to update hydration break:', _err));
    }

    this.active.hydrationBreakEndsAt = Date.now() + durationMs;

    this.active.hydrationBreakTimer = setTimeout(() => {
      if (!this.active) return;
      this.active.hydrationBreakEndsAt = null;
      this.active.hydrationBreakTimer = null;
      this.resume();
    }, durationMs);

    this.broadcastSessionUpdate();
  }

  skip(): void {
    if (!this.active) return;
    this.clearTimer(this.active.timer);
    this.active.timer = null;
    void this.advancePhase();
  }

  adjust(deltaMs: number): void {
    if (!this.active || this.active.pausedAt !== null) return;

    this.active.phaseEndsAt += deltaMs;
    this.clearTimer(this.active.timer);
    this.active.timer = null;
    const remaining = Math.max(0, this.active.phaseEndsAt - Date.now());
    this.scheduleNext(remaining);
    this.broadcastSessionUpdate();
  }

  async stop(): Promise<void> {
    await this.endSession('ABORTED', 'stopped');
  }

  async abort(): Promise<void> {
    await this.endSession('ABORTED', 'error');
  }

  getState(): ActiveSession | null {
    return this.active;
  }

  /** Retourne le message SESSION_UPDATE courant (pour l'envoyer aux nouveaux clients) */
  getSessionUpdateMsg(): { type: 'SESSION_UPDATE'; payload: unknown } {
    if (!this.active) return { type: 'SESSION_UPDATE', payload: null };
    const phase = this.active.phases[this.active.currentPhaseIdx]!;
    return {
      type: 'SESSION_UPDATE',
      payload: {
        id: this.active.sessionId,
        status: this.active.pausedAt !== null ? 'PAUSED' : 'RUNNING',
        circuitId: this.active.circuitId,
        currentPhaseIdx: this.active.currentPhaseIdx,
        totalPhases: this.active.phases.length,
        round: phase.round,
        totalRounds: this.active.totalRounds,
        stationIdx: phase.stationIdx,
        phase: { type: phase.type, label: phase.label, durationMs: phase.durationMs, setNumber: phase.setNumber, totalSets: phase.totalSets, reps: phase.reps, isRepsMode: phase.isRepsMode },
        phaseStartsAt: this.active.phaseStartsAt,
        phaseEndsAt: this.active.phaseEndsAt,
        pausedAt: this.active.pausedAt,
        remainingOnPauseMs: this.active.remainingOnPauseMs,
        hydrationBreakEndsAt: this.active.hydrationBreakEndsAt,
      },
    };
  }

private clearTimer(timer: ReturnType<typeof setTimeout> | null): void {
    if (timer) clearTimeout(timer);
  }

  private clearTimers(): void {
    if (!this.active) return;
    this.clearTimer(this.active.timer);
    this.clearTimer(this.active.hydrationBreakTimer);
    this.active.timer = null;
    this.active.hydrationBreakTimer = null;
  }

  private scheduleNext(ms: number): void {
    this.active!.timer = setTimeout(() => {
      void this.advancePhase();
    }, ms);
  }

  private cleanupTimers(): void {
    this.clearTimer(this.active?.timer ?? null);
    this.clearTimer(this.active?.hydrationBreakTimer ?? null);
  }

  private async advancePhase(): Promise<void> {
    if (!this.active) return;

    const nextIdx = this.active.currentPhaseIdx + 1;

    if (nextIdx >= this.active.phases.length) {
      await this.endSession('COMPLETED', 'completed');
      return;
    }

    const now = Date.now();
    const nextPhase = this.active.phases[nextIdx]!;
    this.active.currentPhaseIdx = nextIdx;
    this.active.phaseStartsAt = now;
    this.active.phaseEndsAt = now + nextPhase.durationMs;

    try {
      await prisma.session.update({
        where: { id: this.active.sessionId },
        data: {
          currentRound: nextPhase.round,
          currentPhase: nextPhase.type,
          currentStationIdx: nextPhase.stationIdx,
          phaseEndsAt: new Date(this.active.phaseEndsAt),
        },
      });
    } catch {
      this.active.timer = null;
      await this.abort();
      return;
    }

    this.scheduleNext(nextPhase.durationMs);
    this.broadcastSessionUpdate();
  }

  private async endSession(
    status: 'COMPLETED' | 'ABORTED',
    reason: 'completed' | 'stopped' | 'error',
  ): Promise<void> {
    if (!this.active) return;

    const sessionId = this.active.sessionId;
    this.cleanupTimers();
    this.active = null;

    await prisma.session.update({
      where: { id: sessionId },
      data: { status, endedAt: new Date() },
    });

    hub.broadcastAll({ type: 'SESSION_ENDED', reason });
  }

  private broadcastSessionUpdate(): void {
    if (!this.active) {
      hub.broadcastAll({ type: 'SESSION_UPDATE', payload: null });
      return;
    }

    const phase = this.active.phases[this.active.currentPhaseIdx]!;
    hub.broadcastAll({
      type: 'SESSION_UPDATE',
      payload: {
        id: this.active.sessionId,
        status: this.active.pausedAt !== null ? 'PAUSED' : 'RUNNING',
        circuitId: this.active.circuitId,
        currentPhaseIdx: this.active.currentPhaseIdx,
        totalPhases: this.active.phases.length,
        round: phase.round,
        totalRounds: this.active.totalRounds,
        stationIdx: phase.stationIdx,
        phase: {
          type:       phase.type,
          label:      phase.label,
          durationMs: phase.durationMs,
          setNumber:  phase.setNumber,
          totalSets:  phase.totalSets,
          reps:       phase.reps,
          isRepsMode: phase.isRepsMode,
        },
        phaseStartsAt: this.active.phaseStartsAt,
        phaseEndsAt: this.active.phaseEndsAt,
        pausedAt: this.active.pausedAt,
        remainingOnPauseMs: this.active.remainingOnPauseMs,
        hydrationBreakEndsAt: this.active.hydrationBreakEndsAt,
      },
    });
  }
}

export const orchestrator = new SessionOrchestrator();
