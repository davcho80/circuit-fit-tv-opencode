// ============================================================
// Store d'authentification (Svelte 5 runes)
// Token JWT stocké dans localStorage sous la clé 'cfitv_token'
// ============================================================

import { auth as authApi } from './api.js';
import type { UserPublic } from './api.js';

const TOKEN_KEY = 'cfitv_token';

interface JwtClaims {
  exp?: number;
}

function decodeClaims(t: string | null): JwtClaims | null {
  if (!t) return null;
  const [, payload] = t.split('.');
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as JwtClaims;
  } catch {
    return null;
  }
}

function tokenExpiresAt(t: string | null): number | null {
  const exp = decodeClaims(t)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

function createAuthStore() {
  const initialToken = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  let token  = $state<string | null>(initialToken);
  let expiresAt = $state<number | null>(tokenExpiresAt(initialToken));
  let user   = $state<UserPublic | null>(null);
  let loading = $state(false);
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;

  function clearExpiryTimer(): void {
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = null;
  }

  function scheduleExpiry(): void {
    clearExpiryTimer();
    if (!expiresAt) return;
    const delay = Math.max(0, expiresAt - Date.now());
    expiryTimer = setTimeout(() => {
      persist(null);
      user = null;
    }, delay);
  }

  function persist(t: string | null): void {
    token = t;
    expiresAt = tokenExpiresAt(t);
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else   localStorage.removeItem(TOKEN_KEY);
    scheduleExpiry();
  }

  async function login(email: string, password: string): Promise<void> {
    const res = await authApi.login(email, password);
    persist(res.token);
    user = res.user;
  }

  async function logout(): Promise<void> {
    persist(null);
    user = null;
  }

  async function hydrate(fetchFn?: typeof globalThis.fetch): Promise<void> {
    if (!token) return;
    if (expiresAt && expiresAt <= Date.now()) {
      persist(null);
      user = null;
      return;
    }
    loading = true;
    try {
      user = await authApi.me(fetchFn);
    } catch {
      // Token expiré ou invalide
      persist(null);
      user = null;
    } finally {
      loading = false;
    }
  }

  scheduleExpiry();

  return {
    get token()               { return token; },
    get expiresAt()           { return expiresAt; },
    get user()                { return user; },
    get loading()             { return loading; },
    get isAdmin()             { return user?.role === 'ADMIN'; },
    get mustChangePassword()  { return user?.mustChangePassword ?? false; },
    login,
    logout,
    hydrate,
  };
}

export const authStore = createAuthStore();
