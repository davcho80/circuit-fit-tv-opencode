// ============================================================
// Circuit Fit TV — Backend
// ------------------------------------------------------------
// Hello world initial. Sera remplacé au Sprint 0 par le vrai
// serveur avec Prisma, WebSocket hub, routes, orchestrateur.
//
// Lancer : npm run dev
// Tester : curl http://localhost:3000/health
// ============================================================

import Fastify, { type FastifyServerOptions } from 'fastify';

const PORT = Number(process.env['BACKEND_PORT'] ?? 3000);
const HOST = process.env['BACKEND_HOST'] ?? '0.0.0.0';
const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'info';
const IS_DEV = process.env['NODE_ENV'] !== 'production';

const loggerConfig: FastifyServerOptions['logger'] = IS_DEV
  ? {
      level: LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    }
  : { level: LOG_LEVEL };

const app = Fastify({ logger: loggerConfig });

app.get('/health', () => ({
  status: 'ok',
  service: 'circuit-fit-tv-backend',
  version: '0.1.0',
  time: new Date().toISOString(),
}));

async function start(): Promise<void> {
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Ready on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();