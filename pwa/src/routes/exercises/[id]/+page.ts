import { exercises } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const exercise = await exercises.get(params.id, fetch);
  return { exercise };
};
