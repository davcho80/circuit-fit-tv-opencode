import assert from 'node:assert/strict';
import { CircuitCreate } from '@cfitv/shared';

const exerciseA = '11111111-1111-4111-8111-111111111111';
const exerciseB = '22222222-2222-4222-8222-222222222222';

const parsed = CircuitCreate.safeParse({
  name: 'Circuit reps optionnelles',
  description: null,
  rounds: 3,
  workSec: 40,
  restSec: 20,
  transitionSec: 10,
  rotationMode: 'CLASSIC',
  stations: [
    {
      position: 1,
      exerciseIds: [exerciseA, exerciseB],
      exerciseConfigs: [
        { exerciseId: exerciseA, sets: 3, reps: 12 },
      ],
    },
    {
      position: 2,
      exerciseIds: [exerciseB],
    },
  ],
});

assert.equal(parsed.success, true);
assert.ok(parsed.success);
assert.deepEqual(parsed.data.stations[0]?.exerciseConfigs, [
  { exerciseId: exerciseA, sets: 3, reps: 12 },
]);
