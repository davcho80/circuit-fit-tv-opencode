import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearTvConfig,
  loadTvConfig,
  saveTvConfig,
  screenRouteFor,
  updateTvConfig,
  type TvConfig,
} from './tvConfig.js';

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

test('saveTvConfig persists a normalized paired TV config', () => {
  installStorage();

  const saved = saveTvConfig({
    displayId: '9a3a9264-9e16-4a87-b3a9-cc0f2589f4e1',
    label: 'Central',
    stationNumber: 1,
    screenType: 'DASHBOARD',
    isLandscape: true,
    tvSecret: 'tv_secret_123',
    primaryColor: '#0ea5e9',
    logoUrl: null,
  });

  assert.equal(saved.screenType, 'CENTRAL');
  assert.equal(saved.mode, 'central');
  assert.equal(saved.tvSecret, 'tv_secret_123');
  assert.equal(loadTvConfig()?.displayId, '9a3a9264-9e16-4a87-b3a9-cc0f2589f4e1');
  assert.equal(screenRouteFor(saved), '/tv/central');
});

test('loadTvConfig ignores corrupt or incomplete storage values', () => {
  installStorage();

  localStorage.setItem('cfitv_tv_config', JSON.stringify({ label: 'bad config' }));

  assert.equal(loadTvConfig(), null);
});

test('updateTvConfig preserves the paired TV secret and changes route mode', () => {
  installStorage();
  saveTvConfig({
    displayId: '9a3a9264-9e16-4a87-b3a9-cc0f2589f4e1',
    label: 'Station 4',
    stationNumber: 4,
    screenType: 'STATION',
    isLandscape: true,
    tvSecret: 'tv_secret_456',
    primaryColor: null,
    logoUrl: null,
  });

  const updated = updateTvConfig({
    displayId: '9a3a9264-9e16-4a87-b3a9-cc0f2589f4e1',
    label: 'Calendrier',
    stationNumber: 1,
    screenType: 'SCHEDULE',
    isLandscape: true,
    primaryColor: '#38bdf8',
    logoUrl: null,
  });

  assert.equal(updated?.tvSecret, 'tv_secret_456');
  assert.equal(updated?.mode, 'schedule');
  assert.equal(updated?.label, 'Calendrier');
  assert.equal(screenRouteFor(updated!), '/tv/schedule');
});

test('clearTvConfig removes the saved config', () => {
  installStorage();
  const config: TvConfig = {
    displayId: '9a3a9264-9e16-4a87-b3a9-cc0f2589f4e1',
    label: 'Station 4',
    stationNumber: 4,
    screenType: 'STATION',
    mode: 'station',
    isLandscape: false,
    tvSecret: 'tv_secret_456',
    primaryColor: null,
    logoUrl: null,
    savedAt: 1,
  };

  saveTvConfig(config);
  clearTvConfig();

  assert.equal(loadTvConfig(), null);
});
