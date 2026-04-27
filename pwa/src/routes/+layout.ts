// SPA pur avec adapter-static : tout le rendering se fait côté client.
// Désactiver SSR évite que les load() tournent côté serveur en dev
// (où VITE_API_URL n'est pas disponible).
export const ssr = false;
export const prerender = false;
