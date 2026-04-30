import type { PhaseType } from '@cfitv/shared';

export interface Phase {
  type: PhaseType;
  label: string;
  durationMs: number;
  stationIdx: number;
  round: number;
  setNumber?: number;
  totalSets?: number;
  reps?: number;
  isRepsMode?: boolean;
}

export interface CircuitWithStations {
  rounds: number;
  workSec: number;
  restSec: number;
  transitionSec: number;
  warmupSec: number;
  cooldownSec: number;
  coachNotes: string | null;
  whiteboardEnabled: boolean;
  stations: Array<{
    position: number;
    stationMode: string;
    sets: number | null;
    reps: number | null;
    restBetweenSetsSec: number | null;
    exercises: Array<{ exercise: { name: string } }>;
  }>;
  scheduledBreaks: Array<{ afterRound: number; durationSec: number; label: string }>;
}

export function buildPhases(circuit: CircuitWithStations): Phase[] {
  const phases: Phase[] = [];
  const stationCount = circuit.stations.length;

  if (circuit.warmupSec > 0) {
    phases.push({
      type: 'WARMUP',
      label: 'Warmup',
      durationMs: circuit.warmupSec * 1000,
      stationIdx: 0,
      round: 1,
    });
  }

  const breaksByRound = new Map<number, { durationSec: number; label: string }>();
  for (const b of circuit.scheduledBreaks) {
    breaksByRound.set(b.afterRound, { durationSec: b.durationSec, label: b.label });
  }

  for (let round = 1; round <= circuit.rounds; round++) {
    for (let si = 0; si < stationCount; si++) {
      const station = circuit.stations[si]!;
      const exerciseNames = station.exercises.map((e) => e.exercise.name).join(' / ');

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
        const totalSets = station.sets ?? 3;
        const reps = station.reps ?? 10;
        const restMs = (station.restBetweenSetsSec ?? 60) * 1000;

        for (let setNum = 1; setNum <= totalSets; setNum++) {
          phases.push({
            type: 'WORK',
            label: `Set ${setNum}/${totalSets} — ${reps} reps`,
            durationMs: 3_600_000,
            stationIdx: si,
            round,
            setNumber: setNum,
            totalSets,
            reps,
            isRepsMode: true,
          });

          if (setNum < totalSets) {
            phases.push({
              type: 'REST',
              label: 'Repos',
              durationMs: restMs,
              stationIdx: si,
              round,
              setNumber: setNum,
              totalSets,
              reps,
              isRepsMode: true,
            });
          }
        }
      } else {
        phases.push({
          type: 'WORK',
          label: exerciseNames || `Station ${station.position}`,
          durationMs: circuit.workSec * 1000,
          stationIdx: si,
          round,
        });

        const isLast = round === circuit.rounds && si === stationCount - 1;
        if (circuit.restSec > 0 && !isLast) {
          phases.push({
            type: 'REST',
            label: 'Repos',
            durationMs: circuit.restSec * 1000,
            stationIdx: si,
            round,
          });
        }
      }
    }

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

  if (circuit.cooldownSec > 0) {
    phases.push({
      type: 'COOLDOWN',
      label: 'Cooldown',
      durationMs: circuit.cooldownSec * 1000,
      stationIdx: 0,
      round: circuit.rounds,
    });
  }

  return phases;
}

