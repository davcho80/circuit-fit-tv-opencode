import { circuits, exercises } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const [circuitList, exerciseData] = await Promise.all([
    circuits.list(fetch),
    exercises.list(1, 1, fetch), // juste pour le total
  ]);
  return {
    circuits: circuitList,
    exerciseCount: exerciseData.total,
  };
};
