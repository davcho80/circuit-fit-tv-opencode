// ============================================================
// Circuit Fit TV — Backend
// ------------------------------------------------------------
// Point d'entrée : Fastify + WebSocket hub + routes REST
//
// Lancer : npm run dev
// Tester : curl http://localhost:3000/health
// WS     : ws://localhost:3000/ws
// ============================================================

import Fastify, { type FastifyServerOptions } from 'fastify';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { Bonjour } from 'bonjour-service';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// En production le build PWA est dans ../pwa/build (relatif au dist/)
const PWA_BUILD = join(__dirname, '..', '..', 'pwa', 'build');

import { config } from './config.js';
import { prisma } from './db.js';
import { ensureBuckets } from './storage.js';
import { hub } from './ws/hub.js';
import type { ClientRole } from './ws/hub.js';
import { handleMessage } from './ws/handlers.js';
import { orchestrator } from './sessions/orchestrator.js';
import { exercisesRoutes } from './routes/exercises.js';
import { circuitsRoutes } from './routes/circuits.js';
import { displaysRoutes } from './routes/displays.js';
import { sessionsRoutes } from './routes/sessions.js';
import { pairRoutes } from './routes/pair.js';
import { schedulesRoutes } from './routes/schedules.js';
import { statsRoutes } from './routes/stats.js';
import { authRoutes } from './routes/auth.js';
import { usersRoutes } from './routes/users.js';
import { setupRoutes } from './routes/setup.js';
import { settingsRoutes } from './routes/settings.js';
import { tvScheduleRoutes } from './routes/tv-schedule.js';
import { updateRoutes }     from './routes/update.js';
import { jwtFastifyPlugin, requireAuth } from './auth/jwt.plugin.js';
import { bootstrapAdmin } from './auth/bootstrap.js';
import { startScheduler } from './sessions/scheduler.js';
import { removeByClient } from './ws/pair.js';

// ---- Fastify instance ----

const loggerConfig: FastifyServerOptions['logger'] = config.isDev
  ? { level: config.logLevel, transport: { target: 'pino-pretty', options: { colorize: true } } }
  : { level: config.logLevel };

const app = Fastify({ logger: loggerConfig });

// ---- Plugins ----

// CORS : autorisé en dev depuis le dev server Vite (5173)
await app.register(cors, {
  origin: config.isDev
    ? ['http://localhost:5173', 'http://127.0.0.1:5173']
    : false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});
// JWT — doit être enregistré avant les routes protégées
await app.register(jwtFastifyPlugin);

// Hook d'auth global : n'applique l'auth QUE sur les routes API connues.
// Les pages SPA (/admin, /circuits, /, etc.) et les assets sont laissés passer
// pour que le navigateur puisse charger le frontend sans token.
const PUBLIC_API_EXACT    = new Set(['/health', '/displays/online']);
const PUBLIC_API_PREFIXES = ['/auth/', '/setup/', '/pair/', '/ws', '/tv-schedule'];
// Préfixes des routes API qui nécessitent une authentification
const PROTECTED_PREFIXES  = [
  '/exercises', '/circuits', '/displays', '/sessions',
  '/schedules', '/stats', '/users', '/settings', '/update',
];

app.addHook('onRequest', async (req, reply) => {
  const url = (req.url ?? '').split('?')[0] ?? '';
  // Pas une route API protégée → laisser passer (SPA page ou asset statique)
  if (!PROTECTED_PREFIXES.some((p) => url.startsWith(p))) return;
  // Routes API publiques explicites
  if (PUBLIC_API_EXACT.has(url))                           return;
  if (PUBLIC_API_PREFIXES.some((p) => url.startsWith(p))) return;
  await requireAuth(req, reply);
});

await app.register(websocket);
await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // 2 GB max
await app.register(rateLimit, {
  global:      true,
  max:         200,          // requêtes par fenêtre
  timeWindow:  '1 minute',
  skipOnError: true,
  // Ne pas appliquer sur le WS ni sur les assets statiques
  allowList: (req, _key) => req.url === '/ws' || req.url.startsWith('/assets'),
});

// ---- Fichiers statiques PWA ----
// En production : sert le build SvelteKit depuis pwa/build/
// En dev : redirige vers le dev server Vite
if (!config.isDev && existsSync(PWA_BUILD)) {
  await app.register(staticFiles, {
    root: PWA_BUILD,
    prefix: '/',
    // SPA fallback : toute route non-trouvée renvoie 200.html
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-cache');
    },
  });
  // Catch-all pour le routage SPA
  app.setNotFoundHandler((_req, reply) => {
    return reply.sendFile('200.html', PWA_BUILD);
  });
} else if (config.isDev) {
  // En dev : redirige tout vers le dev server Vite sur la même IP (chemin + query string préservés)
  // Utilise req.hostname pour que les clients externes (téléphone, TV) puissent suivre la redirection.
  app.setNotFoundHandler((req, reply) => {
    return reply.redirect(`http://${req.hostname}:5173${req.url}`);
  });
}

// ---- Routes REST ----

app.get('/health', async () => {
  // Vérifier DB
  let dbOk = false;
  try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { /* db down */ }

  const clients = hub.all();
  return {
    status:  dbOk ? 'ok' : 'degraded',
    service: 'circuit-fit-tv-backend',
    version: process.env['APP_VERSION'] ?? '0.1.0',
    time:    new Date().toISOString(),
    db:      dbOk ? 'ok' : 'error',
    ws: {
      total:   clients.length,
      coaches: clients.filter((c) => c.role === 'coach').length,
      tvs:     clients.filter((c) => c.role === 'tv').length,
    },
    scheduler: stopScheduler !== null ? 'running' : 'stopped',
  };
});

// GET /displays/online — displayIds actuellement connectés
app.get('/displays/online', () => {
  return { onlineIds: [...hub.onlineDisplayIds()] };
});

await app.register(exercisesRoutes);
await app.register(circuitsRoutes);
await app.register(displaysRoutes);
await app.register(sessionsRoutes);
await app.register(pairRoutes);
await app.register(schedulesRoutes);
await app.register(statsRoutes);
await app.register(authRoutes);
await app.register(usersRoutes);
await app.register(setupRoutes);
await app.register(settingsRoutes);
await app.register(tvScheduleRoutes);
await app.register(updateRoutes);

// ---- WebSocket endpoint ----

app.get('/ws', { websocket: true }, (socket, req) => {
  // On attend le premier message REGISTER pour identifier le client.
  // Avant ça, on ajoute le client comme UNREGISTERED avec un label temp.
  const tempId = randomUUID();
  app.log.debug({ tempId }, 'WS connection established, waiting for REGISTER');

  // Timeout si REGISTER n'arrive pas dans les 10 s
  const registerTimeout = setTimeout(() => {
    socket.close(4001, 'REGISTER timeout');
  }, 10_000);

  let client = hub.add(socket, 'monitor', `unregistered-${tempId}`);

  socket.on('message', (raw: Buffer | string) => {
    const str = typeof raw === 'string' ? raw : raw.toString('utf8');

    // Premier message : REGISTER attendu
    if (client.label.startsWith('unregistered-')) {
      clearTimeout(registerTimeout);

      let parsed: unknown;
      try { parsed = JSON.parse(str); } catch { socket.close(4002, 'Invalid JSON'); return; }

      const p = parsed as Record<string, unknown>;
      if (p['type'] !== 'REGISTER') { socket.close(4003, 'Expected REGISTER'); return; }

      const role = (p['role'] as ClientRole | undefined) ?? 'monitor';
      const label = typeof p['label'] === 'string' ? p['label'] : 'unnamed';
      const displayId = typeof p['displayId'] === 'string' ? p['displayId'] : undefined;

      hub.remove(client.id);
      client = hub.add(socket, role, label, displayId);

      app.log.info({ clientId: client.id, role, label, displayId }, 'WS client registered');

      // Mettre à jour lastSeen à la connexion d'un écran TV appairé
      if (role === 'tv' && displayId) {
        prisma.display.update({ where: { id: displayId }, data: { lastSeen: new Date() } })
          .catch(() => { /* display peut avoir été supprimé */ });
      }

      // WELCOME
      hub.send(client, {
        type: 'WELCOME',
        clientId: client.id,
        serverTime: Date.now(),
      });

      // Envoyer l'état courant de la session au nouveau client
      hub.send(client, orchestrator.getSessionUpdateMsg() as import('@cfitv/shared').ServerMessage);

      // Diffuser la liste mise à jour au coach
      hub.broadcastToCoaches({ type: 'CLIENT_LIST', payload: hub.clientList() });
      return;
    }

    handleMessage(client, str);
  });

  socket.on('close', () => {
    clearTimeout(registerTimeout);
    app.log.info({ clientId: client.id }, 'WS client disconnected');
    removeByClient(client.id);   // nettoyage PIN d'appairage si en cours
    hub.remove(client.id);
    hub.broadcastToCoaches({ type: 'CLIENT_LIST', payload: hub.clientList() });
  });

  socket.on('error', (err: Error) => {
    app.log.error({ clientId: client.id, err }, 'WS error');
  });
});

// ---- Graceful shutdown ----

let stopScheduler: (() => void) | null = null;

async function shutdown(): Promise<void> {
  app.log.info('Shutting down...');
  stopScheduler?.();
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

// ---- Start ----

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    app.log.info('Database connected');

    await bootstrapAdmin();

    // Marquer ABORTED les sessions laissées RUNNING/PAUSED par un crash précédent
    const orphaned = await prisma.session.updateMany({
      where: { status: { in: ['RUNNING', 'PAUSED'] } },
      data:  { status: 'ABORTED', endedAt: new Date() },
    });
    if (orphaned.count > 0) {
      app.log.warn({ count: orphaned.count }, 'Orphaned sessions marked ABORTED');
    }

    await ensureBuckets();
    app.log.info('Storage buckets ready');

    await app.listen({ port: config.port, host: config.host });

    // ── Scheduler : démarrage automatique des sessions planifiées ──
    stopScheduler = startScheduler(app.log);

    // ── mDNS : annonce le serveur sur le réseau local ──────────
    // Permet aux TV Android de découvrir le serveur automatiquement
    // via NsdManager sans saisir l'URL manuellement.
    // Désactivé en production cloud (AWS) où mDNS ne traverse pas Internet.
    if (config.isDev || process.env['MDNS_ENABLED'] === 'true') {
      const bonjour = new Bonjour();
      bonjour.publish({
        name:     'Circuit Fit TV',
        type:     'cfitv',
        port:     config.port,
        protocol: 'tcp',
      });
      app.log.info({ port: config.port }, 'mDNS service published (_cfitv._tcp)');

      // Nettoyage propre à l'arrêt
      process.on('beforeExit', () => bonjour.unpublishAll());
    }
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void start();
