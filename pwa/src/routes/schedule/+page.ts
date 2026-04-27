import { circuits, schedules } from '$lib/api.js';

export async function load() {
  const [circuitList, scheduleList] = await Promise.all([
    circuits.list(),
    schedules.list(),
  ]);

  return { circuits: circuitList, schedules: scheduleList };
}
