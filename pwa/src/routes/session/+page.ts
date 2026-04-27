import { circuits } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const list = await circuits.list(fetch);
  return { circuits: list };
};
