import { displays, users, type Display, type UserPublic } from '$lib/api.js';

const BASE: string = import.meta.env['VITE_API_URL'] ?? '/api';

export async function load({ fetch }: { fetch: typeof globalThis.fetch }) {
  const [displayList, onlineRes, userList] = await Promise.all([
    displays.list(fetch),
    fetch(`${BASE}/displays/online`)
      .then((r) => r.json() as Promise<{ onlineIds: string[] }>)
      .catch(() => ({ onlineIds: [] })),
    users.list().catch(() => [] as UserPublic[]),
  ]);

  return {
    displays:  displayList as Display[],
    onlineIds: new Set<string>(onlineRes.onlineIds),
    users:     userList as UserPublic[],
  };
}
