import { sessions } from '$lib/api.js';

export async function load() {
  const history = await sessions.list();
  return { sessions: history };
}
