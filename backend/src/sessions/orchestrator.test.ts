import assert from 'node:assert/strict';
import { buildPhases, type CircuitWithStations } from './phase-plan.js';

const baseCircuit: CircuitWithStations = {
  rounds: 1,
  workSec: 40,
  restSec: 20,
  transitionSec: 10,
  warmupSec: 300,
  cooldownSec: 180,
  coachNotes: 'Focus technique sur les squats.',
  whiteboardEnabled: true,
  stations: [
    {
      position: 1,
      stationMode: 'TIME',
      sets: null,
      reps: null,
      restBetweenSetsSec: null,
      exercises: [{ exercise: { name: 'Squat' } }],
    },
    {
      position: 2,
      stationMode: 'TIME',
      sets: null,
      reps: null,
      restBetweenSetsSec: null,
      exercises: [{ exercise: { name: 'Push-up' } }],
    },
  ],
  scheduledBreaks: [],
};

const phases = buildPhases(baseCircuit);

assert.equal(phases[0]?.type, 'WARMUP');
assert.equal(phases[0]?.label, 'Warmup');
assert.equal(phases[0]?.durationMs, 300_000);
assert.equal(phases.at(-1)?.type, 'COOLDOWN');
assert.equal(phases.at(-1)?.label, 'Cooldown');
assert.equal(phases.at(-1)?.durationMs, 180_000);
assert.equal(phases.some((phase) => phase.type === 'WORK' && phase.label === 'Squat'), true);

const legacyPhases = buildPhases({
  ...baseCircuit,
  warmupSec: 0,
  cooldownSec: 0,
  coachNotes: null,
  whiteboardEnabled: true,
});

assert.notEqual(legacyPhases[0]?.type, 'WARMUP');
assert.notEqual(legacyPhases.at(-1)?.type, 'COOLDOWN');
