import { exercises } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const exercise = await exercises.get(params.id);
  return { exercise };
};
