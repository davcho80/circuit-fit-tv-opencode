// ============================================================
// Store d'authentification (Svelte 5 runes)
// Token JWT stocké dans localStorage sous la clé 'cfitv_token'
// ============================================================

import { auth as authApi } from './api.js';
import type { UserPublic } from './api.js';

function createAuthStore() {
  let token  = $state<string | null>(
    typeof localStorage !== 'undefined' ? localStorage.getItem('cfitv_token') : null,
  );
  let user   = $state<UserPublic | null>(null);
  let loading = $state(false);

  function persist(t: string | null): void {
    token = t;
    if (t) localStorage.setItem('cfitv_token', t);
    else   localStorage.removeItem('cfitv_token');
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

  return {
    get token()               { return token; },
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
