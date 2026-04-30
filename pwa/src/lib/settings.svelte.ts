// ============================================================
// Store des paramètres studio (branding)
// ============================================================

export interface StudioSettings {
  id:           string;
  studioName:   string;
  primaryColor: string;
  logoUrl:      string | null;
  timezone:     string;
}

const defaults: StudioSettings = {
  id:           'singleton',
  studioName:   'Circuit Fit TV',
  primaryColor: '#0ea5e9',
  logoUrl:      null,
  timezone:     'America/Montreal',
};

const API_BASE: string = import.meta.env['VITE_API_URL'] ?? '';

const settings = $state<StudioSettings>({ ...defaults });

export async function loadSettings(fetchFn: typeof globalThis.fetch = globalThis.fetch): Promise<void> {
  try {
    const res = await fetchFn(`${API_BASE}/settings`);
    if (res.ok) Object.assign(settings, await res.json() as StudioSettings);
  } catch { /* silently ignore */ }
}

export function applyBranding(): void {
  // Applique la couleur principale comme variable CSS sur :root
  document.documentElement.style.setProperty('--color-primary', settings.primaryColor);
}

export { settings as studioSettings };
