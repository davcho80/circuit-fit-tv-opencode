import type { SessionPayload } from './ws.svelte.js';

const SESSION_KEY = 'cfitv_tv_session_snapshot';
const CIRCUIT_KEY = 'cfitv_tv_circuit_snapshot';
const SCHEDULE_KEY = 'cfitv_tv_schedule_snapshot';

interface Snapshot<T> {
  savedAt: number;
  value: T;
}

function storage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function saveSnapshot<T>(key: string, value: T): void {
  storage()?.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
}

function loadSnapshot<T>(key: string): T | null {
  const raw = storage()?.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Snapshot<T>>;
    return parsed && 'value' in parsed ? parsed.value as T : null;
  } catch {
    return null;
  }
}

export function saveTvSessionSnapshot(session: SessionPayload): void {
  saveSnapshot(SESSION_KEY, session);
}

export function loadTvSessionSnapshot(): SessionPayload | null {
  return loadSnapshot<SessionPayload>(SESSION_KEY);
}

export function saveTvCircuitSnapshot<T>(circuit: T): void {
  saveSnapshot(CIRCUIT_KEY, circuit);
}

export function loadTvCircuitSnapshot<T>(): T | null {
  return loadSnapshot<T>(CIRCUIT_KEY);
}

export function saveTvScheduleSnapshot<T>(schedule: T): void {
  saveSnapshot(SCHEDULE_KEY, schedule);
}

export function loadTvScheduleSnapshot<T>(): T | null {
  return loadSnapshot<T>(SCHEDULE_KEY);
}

export function clearTvOfflineSnapshots(): void {
  storage()?.removeItem(SESSION_KEY);
  storage()?.removeItem(CIRCUIT_KEY);
  storage()?.removeItem(SCHEDULE_KEY);
}

