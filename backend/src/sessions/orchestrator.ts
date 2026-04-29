// ============================================================
// Orchestrateur de sessions d'entraînement
// ------------------------------------------------------------
// Gère le cycle de vie d'une session active :
//   - construction de la liste ordonnée des phases
//   - timer (setTimeout) pour avancer automatiquement
//   - diffusion WebSocket à chaque changement d'état
// ============================================================

import type { PhaseType } from '@cfitv/shared';
import { hub } from '../ws/hub.js';
import { prisma } from '../db.js';

interface Phase {
  type: PhaseType;
  label: string;
  durationMs: number;
  stationIdx: number; // index dans circuit.stations
  round: number;
  // Mode REPS
  setNumber?:  number;
  totalSets?:  number;
  reps?:       number;
  isRepsMode?: boolean;
}

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

    if (this.active.timer) clearTimeout(this.active.timer);
    this.active.timer = null;
    this.active.pausedAt = Date.now();
    this.active.remainingOnPauseMs = Math.max(0, this.active.phaseEndsAt - this.active.pausedAt);

    void prisma.session.update({
      where: { id: this.active.sessionId },
      data: { status: 'PAUSED', pausedAt: new Date(this.active.pausedAt), remainingOnPauseMs: this.active.remainingOnPauseMs },
    });

    this.broadcastSessionUpdate();
  }

  resume(): void {
    if (!this.active || this.active.pausedAt === null) return;

    // Annule la pause eau si elle était en cours
    if (this.active.hydrationBreakTimer) {
      clearTimeout(this.active.hydrationBreakTimer);
      this.active.hydrationBreakTimer = null;
    }
    this.active.hydrationBreakEndsAt = null;

    const remaining = this.active.remainingOnPauseMs ?? 0;
    const now = Date.now();
    this.active.phaseStartsAt = now;
    this.active.phaseEndsAt = now + remaining;
    this.active.pausedAt = null;
    this.active.remainingOnPauseMs = null;

    void prisma.session.update({
      where: { id: this.active.sessionId },
      data: { status: 'RUNNING', pausedAt: null, remainingOnPauseMs: null },
    });

    this.scheduleNext(remaining);
    this.broadcastSessionUpdate();
  }

  hydrationBreak(durationMs: number): void {
    if (!this.active) return;

    // Annule un break eau déjà actif
    if (this.active.hydrationBreakTimer) {
      clearTimeout(this.active.hydrationBreakTimer);
      this.active.hydrationBreakTimer = null;
    }

    // Pause la phase si elle tourne
    if (this.active.pausedAt === null) {
      if (this.active.timer) clearTimeout(this.active.timer);
      this.active.timer = null;
      this.active.pausedAt = Date.now();
      this.active.remainingOnPauseMs = Math.max(0, this.active.phaseEndsAt - this.active.pausedAt);
      void prisma.session.update({
        where: { id: this.active.sessionId },
        data: { status: 'PAUSED', pausedAt: new Date(this.active.pausedAt), remainingOnPauseMs: this.active.remainingOnPauseMs },
      });
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
    if (this.active.timer) clearTimeout(this.active.timer);
    void this.advancePhase();
  }

  adjust(deltaMs: number): void {
    if (!this.active || this.active.pausedAt !== null) return;

    this.active.phaseEndsAt += deltaMs;
    if (this.active.timer) clearTimeout(this.active.timer);
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

  private scheduleNext(ms: number): void {
    this.active!.timer = setTimeout(() => {
      void this.advancePhase();
    }, ms);
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

    await prisma.session.update({
      where: { id: this.active.sessionId },
      data: {
        currentRound: nextPhase.round,
        currentPhase: nextPhase.type,
        currentStationIdx: nextPhase.stationIdx,
        phaseEndsAt: new Date(this.active.phaseEndsAt),
      },
    });

    this.scheduleNext(nextPhase.durationMs);
    this.broadcastSessionUpdate();
  }

  private async endSession(
    status: 'COMPLETED' | 'ABORTED',
    reason: 'completed' | 'stopped' | 'error',
  ): Promise<void> {
    if (!this.active) return;

    if (this.active.timer) clearTimeout(this.active.timer);
    if (this.active.hydrationBreakTimer) clearTimeout(this.active.hydrationBreakTimer);
    const sessionId = this.active.sessionId;
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

// ---- Helpers ----

type CircuitWithStations = Awaited<
  ReturnType<typeof prisma.circuit.findUniqueOrThrow>
> & {
  stations: Array<{
    position:          number;
    stationMode:       string;
    sets:              number | null;
    reps:              number | null;
    restBetweenSetsSec: number | null;
    exercises: Array<{ exercise: { name: string } }>;
  }>;
  scheduledBreaks: Array<{ afterRound: number; durationSec: number; label: string }>;
};

function buildPhases(circuit: CircuitWithStations): Phase[] {
  const phases: Phase[] = [];
  const stationCount = circuit.stations.length;

  // Index des pauses par round
  const breaksByRound = new Map<number, { durationSec: number; label: string }>();
  for (const b of circuit.scheduledBreaks) {
    breaksByRound.set(b.afterRound, { durationSec: b.durationSec, label: b.label });
  }

  for (let round = 1; round <= circuit.rounds; round++) {
    for (let si = 0; si < stationCount; si++) {
      const station = circuit.stations[si]!;
      const exerciseNames = station.exercises.map((e) => e.exercise.name).join(' / ');

      // Transition avant chaque station (sauf la première du premier round)
      if (circuit.transitionSec > 0 && !(round === 1 && si === 0)) {
        phases.push({
          type: 'TRANSITION',
          label: `→ Station ${station.position}`,
          durationMs: circuit.transitionSec * 1000,
          stationIdx: si,
          round,
        });
      }

      if (station.stationMode === 'REPS') {
        // ── Mode REPS : sets × (WORK manuel + REST auto) ──────────
        const totalSets = station.sets  ?? 3;
        const reps      = station.reps  ?? 10;
        const restMs    = (station.restBetweenSetsSec ?? 60) * 1000;

        for (let setNum = 1; setNum <= totalSets; setNum++) {
          // WORK : pas de minuterie (1 h = avancement manuel par le coach)
          phases.push({
            type:       'WORK',
            label:      `Set ${setNum}/${totalSets} — ${reps} reps`,
            durationMs: 3_600_000,
            stationIdx: si,
            round,
            setNumber:  setNum,
            totalSets,
            reps,
            isRepsMode: true,
          });

          // REST entre chaque set (pas après le dernier)
          if (setNum < totalSets) {
            phases.push({
              type:       'REST',
              label:      'Repos',
              durationMs: restMs,
              stationIdx: si,
              round,
              setNumber:  setNum,
              totalSets,
              reps,
              isRepsMode: true,
            });
          }
        }
      } else {
        // ── Mode TIME : comportement existant ─────────────────────
        phases.push({
          type:      'WORK',
          label:     exerciseNames || `Station ${station.position}`,
          durationMs: circuit.workSec * 1000,
          stationIdx: si,
          round,
        });

        // Repos après travail (sauf après la dernière station du dernier round)
        const isLast = round === circuit.rounds && si === stationCount - 1;
        if (circuit.restSec > 0 && !isLast) {
          phases.push({
            type:      'REST',
            label:     'Repos',
            durationMs: circuit.restSec * 1000,
            stationIdx: si,
            round,
          });
        }
      }
    }

    // Pause eau programmée après ce round (pas après le dernier round)
    const brk = breaksByRound.get(round);
    if (brk && round < circuit.rounds) {
      phases.push({
        type: 'HYDRATION',
        label: brk.label,
        durationMs: brk.durationSec * 1000,
        stationIdx: 0,
        round,
      });
    }
  }

  return phases;
}

export const orchestrator = new SessionOrchestrator();
