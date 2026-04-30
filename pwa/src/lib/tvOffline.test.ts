import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearTvOfflineSnapshots,
  loadTvCircuitSnapshot,
  loadTvScheduleSnapshot,
  loadTvSessionSnapshot,
  saveTvCircuitSnapshot,
  saveTvScheduleSnapshot,
  saveTvSessionSnapshot,
} from './tvOffline.js';

function installStorage() {
  const values = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => { values.clear(); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

test('stores the last usable TV session and circuit snapshots', () => {
  installStorage();

  saveTvSessionSnapshot({
    id: 'session-1',
    status: 'RUNNING',
    circuitId: 'circuit-1',
    currentPhaseIdx: 0,
    totalPhases: 3,
    round: 1,
    totalRounds: 2,
    stationIdx: 0,
    phase: { type: 'WARMUP', label: 'Warmup', durationMs: 300_000 },
    phaseStartsAt: 1000,
    phaseEndsAt: 301000,
    pausedAt: null,
    remainingOnPauseMs: null,
  });

  saveTvCircuitSnapshot({ id: 'circuit-1', name: 'Circuit A', stations: [] });

  assert.equal(loadTvSessionSnapshot()?.phase.type, 'WARMUP');
  assert.equal(loadTvCircuitSnapshot<{ id: string; name: string }>()?.name, 'Circuit A');
});

test('stores schedule snapshots and ignores corrupt values', () => {
  installStorage();

  saveTvScheduleSnapshot([{ date: '2026-04-30', classes: [] }]);
  assert.equal(loadTvScheduleSnapshot<Array<{ date: string }>>()?.[0]?.date, '2026-04-30');

  localStorage.setItem('cfitv_tv_session_snapshot', '{bad json');
  assert.equal(loadTvSessionSnapshot(), null);

  clearTvOfflineSnapshots();
  assert.equal(loadTvScheduleSnapshot(), null);
});

