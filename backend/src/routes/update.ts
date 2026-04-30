// ============================================================
// Routes Update — vérification et déclenchement des mises à jour
//
// GET  /update/status  → version courante + dernière release GitHub
// POST /update/start   → lance le script de mise à jour (admin)
// GET  /update/stream  → SSE : logs temps réel du script (admin)
//
// Nécessite la variable d'env UPDATE_SCRIPT_PATH pointant vers
// le script shell sur l'hôte (ex: /opt/circuit-fit-tv/update.sh).
// Sans cette variable, /update/start et /update/stream retournent 503.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { spawn }                 from 'node:child_process';
import { requireAdmin }          from '../auth/jwt.plugin.js';
import { auditLog }              from '../audit.js';

const GITHUB_REPO      = 'davcho80/circuit-fit-tv';
const CURRENT_VERSION  = process.env['APP_VERSION'] ?? '0.1.0';
const UPDATE_SCRIPT    = process.env['UPDATE_SCRIPT_PATH'] ?? '';

// ---- Types ----

interface GitHubRelease {
  tag_name:     string;
  name:         string;
  body:         string;
  html_url:     string;
  published_at: string;
}

// ---- Helpers ----

async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          'User-Agent': 'circuit-fit-tv-updater',
          'Accept':     'application/vnd.github.v3+json',
        },
        signal: AbortSignal.timeout(6_000),
      },
    );
    if (!res.ok) return null;
    return await res.json() as GitHubRelease;
  } catch {
    return null;
  }
}

/** Convertit "v1.2.3" ou "1.2.3" en entier comparable */
function versionNum(v: string): number {
  const p = v.replace(/^v/, '').split('.').map(Number);
  return (p[0] ?? 0) * 10_000 + (p[1] ?? 0) * 100 + (p[2] ?? 0);
}

// ---- Routes ----

export async function updateRoutes(app: FastifyInstance): Promise<void> {

  // GET /update/status
  app.get('/update/status', { preHandler: [requireAdmin] }, async () => {
    const latest    = await fetchLatestRelease();
    const latestVer = latest?.tag_name ?? null;

    return {
      currentVersion:  CURRENT_VERSION,
      latestVersion:   latestVer,
      updateAvailable: latestVer ? versionNum(latestVer) > versionNum(CURRENT_VERSION) : false,
      changelog:       latest?.body        ?? null,
      releaseUrl:      latest?.html_url    ?? null,
      publishedAt:     latest?.published_at ?? null,
      canUpdate:       !!UPDATE_SCRIPT,
    };
  });

  // GET /update/stream — SSE : logs du script de mise à jour
  app.get('/update/stream', { preHandler: [requireAdmin] }, async (req, reply) => {
    if (!UPDATE_SCRIPT) {
      return reply.code(503).send({ error: 'UPDATE_SCRIPT_PATH non configuré' });
    }

    // SSE headers
    reply.raw.setHeader('Content-Type',  'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection',    'keep-alive');
    reply.raw.flushHeaders();

    const send = (line: string) => {
      reply.raw.write(`data: ${JSON.stringify(line)}\n\n`);
    };

    send('▶ Démarrage de la mise à jour…');

    const proc = spawn('bash', [UPDATE_SCRIPT], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (chunk: Buffer) => {
      chunk.toString().split('\n').filter(Boolean).forEach(send);
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      chunk.toString().split('\n').filter(Boolean).forEach(send);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        send('✅ Script terminé. Le serveur va redémarrer…');
      } else {
        send(`❌ Erreur — code de sortie ${code}`);
      }
      reply.raw.write('event: done\ndata: {}\n\n');
      reply.raw.end();
    });

    // Si le client coupe la connexion, tuer le process
    req.raw.on('close', () => { proc.kill(); });
  });

  // POST /update/start — déclenche la mise à jour sans SSE (fire-and-forget)
  app.post('/update/start', { preHandler: [requireAdmin] }, async (req, reply) => {
    if (!UPDATE_SCRIPT) {
      return reply.code(503).send({ error: 'UPDATE_SCRIPT_PATH non configuré' });
    }
    await auditLog(req, {
      action:   'system.update.started',
      metadata: { scriptConfigured: true },
    });
    // Lancer le script en arrière-plan, détaché du process parent
    spawn('bash', [UPDATE_SCRIPT], { detached: true, stdio: 'ignore' }).unref();
    return reply.code(202).send({ status: 'updating' });
  });
}
