import { circuits } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const list = await circuits.list();
  return { circuits: list };
};
