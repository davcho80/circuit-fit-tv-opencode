// SPA pur avec adapter-static : tout le rendering se fait côté client.
// Désactiver SSR évite que les load() tournent côté serveur en dev
// (où VITE_API_URL n'est pas disponible).
export const ssr = false;
export const prerender = false;

import { redirect } from '@sveltejs/kit';
import { authStore } from '$lib/auth.svelte.js';
import type { LayoutLoad } from './$types';

// Routes accessibles sans authentification
const PUBLIC_PREFIXES = ['/login', '/change-password', '/setup', '/tv'];

const API_BASE: string = import.meta.env['VITE_API_URL'] ?? '';

export const load: LayoutLoad = async ({ url, fetch }) => {
  const pathname = url.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Vérifier si le setup initial est nécessaire (aucun utilisateur en base)
  try {
    const res = await fetch(`${API_BASE}/setup/status`);
    if (res.ok) {
      const status = await res.json() as { needsSetup: boolean };
      if (status.needsSetup && pathname !== '/setup') {
        throw redirect(302, '/setup');
      }
      if (!status.needsSetup && pathname === '/setup') {
        throw redirect(302, '/login');
      }
    }
  } catch (e) {
    // Si c'est un redirect Svelte, le propager
    if (e && typeof e === 'object' && 'status' in e) throw e;
    // Sinon ignorer (serveur inaccessible)
  }

  // Hydrater le store si token présent mais user pas encore chargé
  if (authStore.token && !authStore.user) {
    await authStore.hydrate(fetch);
  }

  if (!authStore.token && !isPublic) {
    const dest = url.pathname + (url.search ? url.search : '');
    throw redirect(302, `/login?redirect=${encodeURIComponent(dest)}`);
  }

  if (authStore.mustChangePassword && pathname !== '/change-password') {
    throw redirect(302, '/change-password');
  }

  return { user: authStore.user };
};
