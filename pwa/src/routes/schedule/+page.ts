import { circuits, schedules } from '$lib/api.js';

export async function load({ fetch }: { fetch: typeof globalThis.fetch }) {
  const [circuitList, scheduleList] = await Promise.all([
    circuits.list(fetch),
    schedules.list(fetch),
  ]);

  return { circuits: circuitList, schedules: scheduleList };
}
