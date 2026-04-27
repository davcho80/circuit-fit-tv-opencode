import { sessions } from '$lib/api.js';

export async function load({ fetch }: { fetch: typeof globalThis.fetch }) {
  const history = await sessions.list(fetch);
  return { sessions: history };
}
