import { displays, type Display } from '$lib/api.js';

const BASE: string = import.meta.env['VITE_API_URL'] ?? '';

export async function load() {
  const [displayList, onlineRes] = await Promise.all([
    displays.list(),
    fetch(`${BASE}/displays/online`).then((r) => r.json() as Promise<{ onlineIds: string[] }>).catch(() => ({ onlineIds: [] })),
  ]);

  return {
    displays: displayList,
    onlineIds: new Set<string>(onlineRes.onlineIds),
  };
}
