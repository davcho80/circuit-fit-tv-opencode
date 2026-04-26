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
import { randomUUID } from 'node:crypto';

import { config } from './config.js';
import { prisma } from './db.js';
import { ensureBuckets } from './storage.js';
import { hub } from './ws/hub.js';
import type { ClientRole } from './ws/hub.js';
import { handleMessage } from './ws/handlers.js';
import { exercisesRoutes } from './routes/exercises.js';
import { circuitsRoutes } from './routes/circuits.js';
import { displaysRoutes } from './routes/displays.js';
import { sessionsRoutes } from './routes/sessions.js';

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
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});
await app.register(websocket);
await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // 2 GB max

// ---- Routes REST ----

app.get('/health', () => ({
  status: 'ok',
  service: 'circuit-fit-tv-backend',
  version: '0.1.0',
  time: new Date().toISOString(),
  clients: hub.all().length,
}));

await app.register(exercisesRoutes);
await app.register(circuitsRoutes);
await app.register(displaysRoutes);
await app.register(sessionsRoutes);

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

      app.log.info({ clientId: client.id, role, label }, 'WS client registered');

      // WELCOME
      hub.send(client, {
        type: 'WELCOME',
        clientId: client.id,
        serverTime: Date.now(),
      });

      // Diffuser la liste mise à jour au coach
      hub.broadcastToCoaches({ type: 'CLIENT_LIST', payload: hub.clientList() });
      return;
    }

    handleMessage(client, str);
  });

  socket.on('close', () => {
    clearTimeout(registerTimeout);
    app.log.info({ clientId: client.id }, 'WS client disconnected');
    hub.remove(client.id);
    hub.broadcastToCoaches({ type: 'CLIENT_LIST', payload: hub.clientList() });
  });

  socket.on('error', (err: Error) => {
    app.log.error({ clientId: client.id, err }, 'WS error');
  });
});

// ---- Graceful shutdown ----

async function shutdown(): Promise<void> {
  app.log.info('Shutting down...');
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

    await ensureBuckets();
    app.log.info('Storage buckets ready');

    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void start();
