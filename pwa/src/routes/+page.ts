import { circuits, exercises } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const [circuitList, exerciseData] = await Promise.all([
    circuits.list(),
    exercises.list(1, 1), // juste pour le total
  ]);
  return {
    circuits: circuitList,
    exerciseCount: exerciseData.total,
  };
};
