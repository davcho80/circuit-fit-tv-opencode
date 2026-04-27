import { displays } from '$lib/api.js';

export async function load() {
  const displayList = await displays.list();
  return { displays: displayList };
}
