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
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { Bonjour } from 'bonjour-service';
import { RegisterMsg } from '@cfitv/shared';
import type { ServerMessage } from '@cfitv/shared';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// En production le build PWA est dans ../pwa/build (relatif au dist/)
const PWA_BUILD = join(__dirname, '..', '..', 'pwa', 'build');

import { config } from './config.js';
import { prisma } from './db.js';
import { checkStorageBuckets, ensureBuckets } from './storage.js';
import { hub } from './ws/hub.js';
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
import { jwtFastifyPlugin, requireAdmin, requireAuth } from './auth/jwt.plugin.js';
import type { JwtUser } from './auth/jwt.plugin.js';
import { bootstrapAdmin } from './auth/bootstrap.js';
import { startScheduler } from './sessions/scheduler.js';
import { removeByClient } from './ws/pair.js';

// ---- Fastify instance ----

const loggerConfig: FastifyServerOptions['logger'] = config.isDev
  ? { level: config.logLevel, transport: { target: 'pino-pretty', options: { colorize: true } } }
  : { level: config.logLevel };

const app = Fastify({ logger: loggerConfig });

function hashTvSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

async function verifyTvSecret(displayId: string, tvSecret: string | undefined): Promise<boolean> {
  const display = await prisma.display.findUnique({
    where:  { id: displayId },
    select: { tvSecretHash: true },
  });
  if (!display) return false;
  if (!display.tvSecretHash) return true;
  if (!tvSecret) return false;

  const expected = Buffer.from(display.tvSecretHash, 'hex');
  const actual = Buffer.from(hashTvSecret(tvSecret), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ---- Plugins ----

// CORS : en dev, autorise tout le réseau local sur le port Vite (5173)
await app.register(cors, {
  origin: config.isDev
    ? (origin, cb) => {
        // Autorise localhost, 127.0.0.1, et toute IP privée (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        if (!origin) return cb(null, true);
        try {
          const host = new URL(origin).hostname;
          const ok =
            host === 'localhost' ||
            host === '127.0.0.1' ||
            /^192\.168\./.test(host) ||
            /^10\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(host);
          cb(null, ok);
        } catch {
          cb(null, false);
        }
      }
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
  '/diagnostics',
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

async function checkDatabase(): Promise<{ ok: boolean; error: string | null }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

app.get('/health', async () => {
  const [db, storage] = await Promise.all([
    checkDatabase(),
    checkStorageBuckets(),
  ]);

  const clients = hub.all();
  const activeSession = orchestrator.getState();
  const degraded = !db.ok || !storage.ok;

  return {
    status:  degraded ? 'degraded' : 'ok',
    service: 'circuit-fit-tv-backend',
    version: process.env['APP_VERSION'] ?? '0.1.0',
    time:    new Date().toISOString(),
    db:      db.ok ? 'ok' : 'error',
    storage: {
      status: storage.ok ? 'ok' : 'error',
      buckets: storage.buckets.map((bucket) => ({
        name: bucket.name,
        status: bucket.ok ? 'ok' : 'error',
      })),
    },
    ws: {
      total:   clients.length,
      coaches: clients.filter((c) => c.role === 'coach').length,
      tvs:     clients.filter((c) => c.role === 'tv').length,
      monitors: clients.filter((c) => c.role === 'monitor').length,
    },
    scheduler: stopScheduler !== null ? 'running' : 'stopped',
    session: activeSession
      ? {
          id: activeSession.sessionId,
          circuitId: activeSession.circuitId,
          status: activeSession.pausedAt === null ? 'running' : 'paused',
          phaseEndsAt: new Date(activeSession.phaseEndsAt).toISOString(),
        }
      : null,
  };
});

app.get('/diagnostics', { preHandler: [requireAdmin] }, async () => {
  const [db, storage, displays] = await Promise.all([
    checkDatabase(),
    checkStorageBuckets(),
    prisma.display.findMany({ orderBy: { pairedAt: 'asc' } }),
  ]);
  const clients = hub.all();
  const onlineIds = hub.onlineDisplayIds();
  const now = Date.now();
  const activeSession = orchestrator.getState();

  return {
    status: db.ok && storage.ok ? 'ok' : 'degraded',
    generatedAt: new Date(now).toISOString(),
    version: process.env['APP_VERSION'] ?? '0.1.0',
    components: {
      database: db,
      storage,
      scheduler: { ok: stopScheduler !== null, status: stopScheduler !== null ? 'running' : 'stopped' },
      websocket: {
        ok: true,
        total: clients.length,
        byRole: {
          coach: clients.filter((c) => c.role === 'coach').length,
          tv: clients.filter((c) => c.role === 'tv').length,
          monitor: clients.filter((c) => c.role === 'monitor').length,
        },
      },
    },
    session: activeSession
      ? {
          id: activeSession.sessionId,
          circuitId: activeSession.circuitId,
          status: activeSession.pausedAt === null ? 'running' : 'paused',
          currentPhaseIdx: activeSession.currentPhaseIdx,
          totalPhases: activeSession.phases.length,
          phaseEndsAt: new Date(activeSession.phaseEndsAt).toISOString(),
        }
      : null,
    displays: displays.map((display) => {
      const lastSeenAt = display.lastSeen?.toISOString() ?? null;
      const lastSeenSecondsAgo = display.lastSeen
        ? Math.max(0, Math.round((now - display.lastSeen.getTime()) / 1000))
        : null;
      const online = onlineIds.has(display.id);

      return {
        id: display.id,
        name: display.name,
        role: display.role,
        stationNumber: display.stationNumber,
        online,
        status: online ? 'online' : display.lastSeen ? 'offline' : 'never_seen',
        lastSeenAt,
        lastSeenSecondsAgo,
        deviceModel: display.deviceModel,
        deviceOs: display.deviceOs,
        appVersion: display.appVersion,
      };
    }),
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

app.get('/ws', { websocket: true }, (socket, _req) => {
  // On attend le premier message REGISTER pour identifier le client.
  // Avant ça, on ajoute le client comme UNREGISTERED avec un label temp.
  const tempId = randomUUID();
  app.log.debug({ tempId }, 'WS connection established, waiting for REGISTER');

  // Timeout si REGISTER n'arrive pas dans les 10 s
  const registerTimeout = setTimeout(() => {
    socket.close(4001, 'REGISTER timeout');
  }, 10_000);

  let client = hub.add(socket, 'monitor', `unregistered-${tempId}`);

  socket.on('message', async (raw: Buffer | string) => {
    const str = typeof raw === 'string' ? raw : raw.toString('utf8');

    // Premier message : REGISTER attendu
    if (client.label.startsWith('unregistered-')) {
      clearTimeout(registerTimeout);

      let parsed: unknown;
      try { parsed = JSON.parse(str); } catch { socket.close(4002, 'Invalid JSON'); return; }

      const register = RegisterMsg.safeParse(parsed);
      if (!register.success) { socket.close(4003, 'Expected REGISTER'); return; }

      const { role, label, displayId, tvSecret, authToken } = register.data;
      let authenticatedUser: JwtUser | null = null;

      if (role === 'coach' || role === 'monitor') {
        if (!authToken) { socket.close(4401, 'Auth required'); return; }

        try {
          authenticatedUser = app.jwt.verify<JwtUser>(authToken);
        } catch {
          socket.close(4401, 'Invalid auth token');
          return;
        }

        if (authenticatedUser.role !== 'ADMIN' && authenticatedUser.role !== 'COACH') {
          socket.close(4403, 'Forbidden');
          return;
        }
      }

      if (role === 'tv' && displayId) {
        const tvAllowed = await verifyTvSecret(displayId, tvSecret);
        if (!tvAllowed) {
          socket.close(4403, 'Invalid TV secret');
          return;
        }
      }

      hub.remove(client.id);
      client = hub.add(socket, role, label, displayId);

      app.log.info(
        { clientId: client.id, role, label, displayId, userId: authenticatedUser?.sub },
        'WS client registered',
      );

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
      hub.send(client, orchestrator.getSessionUpdateMsg() as ServerMessage);

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
