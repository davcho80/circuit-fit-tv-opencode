import { circuits, exercises } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const [circuit, exercisesData] = await Promise.all([
    circuits.get(params.id, fetch),
    exercises.list(1, 200, fetch),
  ]);
  return { circuit, exercises: exercisesData.items };
};
