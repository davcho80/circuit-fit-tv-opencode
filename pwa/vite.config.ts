import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Circuit Fit TV',
        short_name: 'CircuitFit',
        description: 'Pilotez vos circuits d\'entraînement multi-écrans',
        id: '/',
        start_url: '/',
        scope: '/',
        lang: 'fr-CA',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'browser'],
        orientation: 'landscape',
        categories: ['health', 'fitness', 'sports', 'productivity'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        navigateFallback: '200.html',
        runtimeCaching: [
          {
            // Les routes API sont servies à la racine par Fastify, pas sous /api.
            urlPattern: ({ url }) => [
              '/circuits',
              '/settings',
              '/tv-schedule',
            ].some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`)),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tv-api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              request.destination === 'image' ||
              request.destination === 'video' ||
              url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tv-media-cache',
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    // Écoute sur toutes les interfaces pour que le téléphone/TV puisse accéder
    // au dev server depuis le réseau local (nécessaire pour tester le flux QR).
    host: true,
    // Proxy : toutes les routes API/WS sont redirigées vers le backend Fastify.
    // Permet aux appareils externes (téléphone, tablette) d'appeler l'API via
    // l'IP du Mac sur le port Vite (5173) sans avoir à connaître le port backend.
    proxy: {
      '/auth':       { target: 'http://localhost:3000', changeOrigin: true },
      '/exercises':  { target: 'http://localhost:3000', changeOrigin: true },
      '/circuits':   { target: 'http://localhost:3000', changeOrigin: true },
      '/displays':   { target: 'http://localhost:3000', changeOrigin: true },
      '/sessions':   { target: 'http://localhost:3000', changeOrigin: true },
      '/schedules':  { target: 'http://localhost:3000', changeOrigin: true },
      '/stats':      { target: 'http://localhost:3000', changeOrigin: true },
      '/users':      { target: 'http://localhost:3000', changeOrigin: true },
      '/settings':   { target: 'http://localhost:3000', changeOrigin: true },
      '/update':     { target: 'http://localhost:3000', changeOrigin: true },
      '/pair':       { target: 'http://localhost:3000', changeOrigin: true },
      '/setup':      { target: 'http://localhost:3000', changeOrigin: true },
      '/health':     { target: 'http://localhost:3000', changeOrigin: true },
      '/tv-schedule':{ target: 'http://localhost:3000', changeOrigin: true },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
