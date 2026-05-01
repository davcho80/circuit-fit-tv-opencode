export type PairScreenType = 'STATION' | 'DASHBOARD' | 'CENTRAL' | 'SCHEDULE';
export type TvMode = 'station' | 'central' | 'schedule';

export interface PairConfigPayload {
  displayId: string;
  label: string;
  stationNumber: number;
  screenType: PairScreenType;
  isLandscape: boolean;
  tvSecret: string;
  primaryColor?: string | null;
  logoUrl?: string | null;
}

export type TvConfigUpdatePayload = Omit<PairConfigPayload, 'tvSecret'>;

export interface TvConfig {
  displayId: string;
  label: string;
  stationNumber: number;
  screenType: 'STATION' | 'CENTRAL' | 'SCHEDULE';
  mode: TvMode;
  isLandscape: boolean;
  tvSecret: string;
  primaryColor: string | null;
  logoUrl: string | null;
  savedAt: number;
}

const STORAGE_KEY = 'cfitv_tv_config';

function storage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function modeFor(screenType: PairScreenType): TvMode {
  if (screenType === 'SCHEDULE') return 'schedule';
  if (screenType === 'DASHBOARD' || screenType === 'CENTRAL') return 'central';
  return 'station';
}

function normalizedScreenType(screenType: PairScreenType): TvConfig['screenType'] {
  if (screenType === 'DASHBOARD') return 'CENTRAL';
  return screenType;
}

export function screenRouteFor(config: TvConfig): '/tv' | '/tv/central' | '/tv/schedule' {
  if (config.mode === 'central') return '/tv/central';
  if (config.mode === 'schedule') return '/tv/schedule';
  return '/tv';
}

function isTvConfig(value: unknown): value is TvConfig {
  if (!value || typeof value !== 'object') return false;
  const cfg = value as Partial<TvConfig>;
  return (
    typeof cfg.displayId === 'string' &&
    typeof cfg.label === 'string' &&
    typeof cfg.stationNumber === 'number' &&
    (cfg.screenType === 'STATION' || cfg.screenType === 'CENTRAL' || cfg.screenType === 'SCHEDULE') &&
    (cfg.mode === 'station' || cfg.mode === 'central' || cfg.mode === 'schedule') &&
    typeof cfg.isLandscape === 'boolean' &&
    typeof cfg.tvSecret === 'string' &&
    typeof cfg.savedAt === 'number'
  );
}

export function saveTvConfig(payload: PairConfigPayload): TvConfig {
  const config: TvConfig = {
    displayId: payload.displayId,
    label: payload.label,
    stationNumber: payload.stationNumber,
    screenType: normalizedScreenType(payload.screenType),
    mode: modeFor(payload.screenType),
    isLandscape: payload.isLandscape,
    tvSecret: payload.tvSecret,
    primaryColor: payload.primaryColor ?? null,
    logoUrl: payload.logoUrl ?? null,
    savedAt: Date.now(),
  };

  storage()?.setItem(STORAGE_KEY, JSON.stringify(config));
  return config;
}

export function updateTvConfig(payload: TvConfigUpdatePayload): TvConfig | null {
  const current = loadTvConfig();
  if (!current || current.displayId !== payload.displayId) return null;

  const config: TvConfig = {
    ...current,
    label: payload.label,
    stationNumber: payload.stationNumber,
    screenType: normalizedScreenType(payload.screenType),
    mode: modeFor(payload.screenType),
    isLandscape: payload.isLandscape,
    primaryColor: payload.primaryColor ?? null,
    logoUrl: payload.logoUrl ?? null,
    savedAt: Date.now(),
  };

  storage()?.setItem(STORAGE_KEY, JSON.stringify(config));
  return config;
}

export function loadTvConfig(): TvConfig | null {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isTvConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearTvConfig(): void {
  storage()?.removeItem(STORAGE_KEY);
}
