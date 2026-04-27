// SPA pur avec adapter-static : tout le rendering se fait côté client.
// Désactiver SSR évite que les load() tournent côté serveur en dev
// (où VITE_API_URL n'est pas disponible).
export const ssr = false;
export const prerender = false;

import { redirect } from '@sveltejs/kit';
import { authStore } from '$lib/auth.svelte.js';
import type { LayoutLoad } from './$types';

// Routes accessibles sans authentification
const PUBLIC_PREFIXES = ['/login', '/change-password', '/tv'];

export const load: LayoutLoad = async ({ url }) => {
  const pathname = url.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Hydrater le store si token présent mais user pas encore chargé
  if (authStore.token && !authStore.user) {
    await authStore.hydrate();
  }

  if (!authStore.token && !isPublic) {
    throw redirect(302, '/login');
  }

  if (authStore.mustChangePassword && pathname !== '/change-password') {
    throw redirect(302, '/change-password');
  }

  return { user: authStore.user };
};
