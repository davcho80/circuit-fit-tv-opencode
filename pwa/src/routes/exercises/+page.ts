import { exercises } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const data = await exercises.list(1, 50);
  return { exercises: data.items, total: data.total };
};
