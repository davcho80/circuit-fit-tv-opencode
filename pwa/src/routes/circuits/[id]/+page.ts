import { circuits, exercises } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const [circuit, exercisesData] = await Promise.all([
    circuits.get(params.id),
    exercises.list(1, 200),
  ]);
  return { circuit, exercises: exercisesData.items };
};
