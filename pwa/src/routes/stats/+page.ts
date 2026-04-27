import { stats } from '$lib/api.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const data = await stats.get(fetch);
  return { stats: data };
};
