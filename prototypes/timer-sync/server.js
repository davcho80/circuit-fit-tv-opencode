// ============================================================
// Circuit Fit TV — PoC Timer Sync
// ------------------------------------------------------------
// Objectif : prouver qu'on peut synchroniser un timer sur
// plusieurs écrans avec une dérive < 100ms en utilisant
// un pattern NTP-like pour l'offset d'horloge.
// ============================================================

const path = require('node:path');
const crypto = require('node:crypto');
const fastify = require('fastify')({ logger: { level: 'info' } });

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ============================================================
// État en mémoire (serveur autoritaire)
// ============================================================

const state = {
  // Session courante. null si aucune session en cours.
  session: null,
  // Map<clientId, {socket, role, label, connectedAt, lastPing}>
  clients: new Map(),
};

// Structure d'une session :
// {
//   id, createdAt, status: 'running' | 'paused' | 'stopped',
//   phases: [{ type: 'work'|'rest'|'transition', durationMs, label }, ...],
//   currentPhaseIdx: number,
//   phaseStartsAt: number (epoch ms, absolute),
//   phaseEndsAt: number (epoch ms, absolute),
//   pausedAt: number | null,
//   remainingOnPauseMs: number | null,
// }

// ============================================================
// Utilitaires
// ============================================================

function now() {
  return Date.now();
}

function broadcast(type, payload, predicate = () => true) {
  const message = JSON.stringify({ type, payload, serverTime: now() });
  let count = 0;
  for (const [, client] of state.clients) {
    if (client.socket.readyState === 1 && predicate(client)) {
      client.socket.send(message);
      count++;
    }
  }
  fastify.log.info(`[broadcast] ${type} → ${count} client(s)`);
}

function sendTo(clientId, type, payload) {
  const client = state.clients.get(clientId);
  if (!client || client.socket.readyState !== 1) return;
  client.socket.send(JSON.stringify({ type, payload, serverTime: now() }));
}

function snapshotSession() {
  if (!state.session) return null;
  const s = state.session;
  const phase = s.phases[s.currentPhaseIdx] || null;
  return {
    id: s.id,
    status: s.status,
    currentPhaseIdx: s.currentPhaseIdx,
    totalPhases: s.phases.length,
    phase: phase
      ? { type: phase.type, label: phase.label, durationMs: phase.durationMs }
      : null,
    phaseStartsAt: s.phaseStartsAt,
    phaseEndsAt: s.phaseEndsAt,
    pausedAt: s.pausedAt,
    remainingOnPauseMs: s.remainingOnPauseMs,
  };
}

function broadcastSessionUpdate() {
  broadcast('SESSION_UPDATE', snapshotSession());
}

function broadcastClientList() {
  const list = Array.from(state.clients.values()).map((c) => ({
    id: c.id,
    role: c.role,
    label: c.label,
    connectedAt: c.connectedAt,
  }));
  broadcast('CLIENT_LIST', list, (c) => c.role === 'coach');
}

// ============================================================
// Logique de session
// ============================================================

function buildDemoPhases() {
  // Circuit de démo : 3 stations, 2 rounds
  // transition 5s → work 15s → rest 5s, répété
  const phases = [];
  const rounds = 2;
  const stations = 3;
  for (let r = 1; r <= rounds; r++) {
    for (let s = 1; s <= stations; s++) {
      phases.push({
        type: 'transition',
        durationMs: 5000,
        label: `Round ${r} — Transition vers station ${s}`,
      });
      phases.push({
        type: 'work',
        durationMs: 15000,
        label: `Round ${r} — Station ${s} : Travail`,
      });
      if (!(r === rounds && s === stations)) {
        phases.push({
          type: 'rest',
          durationMs: 5000,
          label: `Round ${r} — Repos`,
        });
      }
    }
  }
  return phases;
}

function startSession() {
  const phases = buildDemoPhases();
  const startedAt = now();
  const phase0 = phases[0];
  state.session = {
    id: crypto.randomUUID(),
    createdAt: startedAt,
    status: 'running',
    phases,
    currentPhaseIdx: 0,
    phaseStartsAt: startedAt,
    phaseEndsAt: startedAt + phase0.durationMs,
    pausedAt: null,
    remainingOnPauseMs: null,
  };
  scheduleNextPhase();
  broadcastSessionUpdate();
  fastify.log.info(`[session] started ${state.session.id} with ${phases.length} phases`);
}

let phaseTimer = null;

function scheduleNextPhase() {
  clearTimeout(phaseTimer);
  if (!state.session || state.session.status !== 'running') return;
  const remaining = state.session.phaseEndsAt - now();
  if (remaining <= 0) {
    advancePhase();
    return;
  }
  phaseTimer = setTimeout(() => advancePhase(), remaining);
}

function advancePhase() {
  if (!state.session) return;
  const s = state.session;
  s.currentPhaseIdx++;
  if (s.currentPhaseIdx >= s.phases.length) {
    // Fin de session
    s.status = 'stopped';
    s.phaseStartsAt = null;
    s.phaseEndsAt = null;
    broadcastSessionUpdate();
    fastify.log.info(`[session] completed`);
    state.session = null;
    broadcast('SESSION_ENDED', { reason: 'completed' });
    return;
  }
  const phase = s.phases[s.currentPhaseIdx];
  s.phaseStartsAt = now();
  s.phaseEndsAt = s.phaseStartsAt + phase.durationMs;
  broadcastSessionUpdate();
  scheduleNextPhase();
}

function pauseSession() {
  if (!state.session || state.session.status !== 'running') return;
  clearTimeout(phaseTimer);
  state.session.status = 'paused';
  state.session.pausedAt = now();
  state.session.remainingOnPauseMs = Math.max(0, state.session.phaseEndsAt - now());
  broadcastSessionUpdate();
}

function resumeSession() {
  if (!state.session || state.session.status !== 'paused') return;
  const remaining = state.session.remainingOnPauseMs;
  state.session.status = 'running';
  state.session.phaseStartsAt = now();
  state.session.phaseEndsAt = now() + remaining;
  state.session.pausedAt = null;
  state.session.remainingOnPauseMs = null;
  scheduleNextPhase();
  broadcastSessionUpdate();
}

function skipPhase() {
  if (!state.session) return;
  if (state.session.status === 'paused') {
    // Reprendre d'abord, puis avancer
    resumeSession();
  }
  clearTimeout(phaseTimer);
  advancePhase();
}

function adjustTimer(deltaMs) {
  if (!state.session) return;
  if (state.session.status === 'running') {
    state.session.phaseEndsAt += deltaMs;
    scheduleNextPhase();
  } else if (state.session.status === 'paused') {
    state.session.remainingOnPauseMs = Math.max(
      0,
      state.session.remainingOnPauseMs + deltaMs
    );
  }
  broadcastSessionUpdate();
}

function stopSession() {
  clearTimeout(phaseTimer);
  state.session = null;
  broadcast('SESSION_ENDED', { reason: 'stopped' });
  broadcast('SESSION_UPDATE', null);
}

// ============================================================
// Routes HTTP et WebSocket
// ============================================================

async function main() {
  await fastify.register(require('@fastify/websocket'));
  await fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'public'),
    prefix: '/',
  });

  // Alias d'URL conviviaux
  fastify.get('/coach', (req, reply) => reply.sendFile('coach.html'));
  fastify.get('/tv', (req, reply) => reply.sendFile('tv.html'));
  fastify.get('/drift', (req, reply) => reply.sendFile('drift.html'));

  // Endpoint d'info (utile pour debug)
  fastify.get('/api/state', async () => ({
    session: snapshotSession(),
    clients: state.clients.size,
    serverTime: now(),
  }));

  // WebSocket principal
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const clientId = crypto.randomUUID();
    let client = {
      id: clientId,
      socket,
      role: 'unknown',
      label: 'Unknown',
      connectedAt: now(),
      lastPing: now(),
    };
    state.clients.set(clientId, client);
    fastify.log.info(`[ws] connect ${clientId} from ${req.ip}`);

    // Bienvenue + envoyer l'état actuel
    socket.send(
      JSON.stringify({
        type: 'WELCOME',
        payload: { clientId, serverTime: now() },
      })
    );

    socket.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (e) {
        return;
      }
      const { type, payload } = msg;

      switch (type) {
        case 'REGISTER': {
          client.role = payload?.role || 'tv';
          client.label = payload?.label || client.role;
          // Envoyer immédiatement un snapshot de la session
          sendTo(clientId, 'SESSION_UPDATE', snapshotSession());
          broadcastClientList();
          fastify.log.info(
            `[ws] ${clientId} registered as ${client.role} (${client.label})`
          );
          break;
        }
        case 'CLOCK_PING': {
          // Pattern NTP-like simplifié.
          // Le client envoie son t0, le serveur renvoie t1 (réception) et t2 (envoi).
          // Le client calcule l'offset et le RTT.
          const t1 = now();
          const t2 = now();
          sendTo(clientId, 'CLOCK_PONG', {
            clientT0: payload.clientT0,
            serverT1: t1,
            serverT2: t2,
          });
          break;
        }
        case 'HEARTBEAT': {
          client.lastPing = now();
          sendTo(clientId, 'HEARTBEAT_ACK', { serverTime: now() });
          break;
        }
        // --- Commandes du coach ---
        case 'START': {
          if (client.role === 'coach') {
            stopSession();
            startSession();
          }
          break;
        }
        case 'PAUSE': {
          if (client.role === 'coach') pauseSession();
          break;
        }
        case 'RESUME': {
          if (client.role === 'coach') resumeSession();
          break;
        }
        case 'SKIP': {
          if (client.role === 'coach') skipPhase();
          break;
        }
        case 'ADJUST': {
          if (client.role === 'coach') adjustTimer(payload?.deltaMs || 0);
          break;
        }
        case 'STOP': {
          if (client.role === 'coach') stopSession();
          break;
        }
        // --- Télémétrie de dérive (les TV envoient leur timer local) ---
        case 'DRIFT_REPORT': {
          broadcast(
            'DRIFT_DATA',
            { clientId, label: client.label, ...payload },
            (c) => c.role === 'coach'
          );
          break;
        }
        default:
          fastify.log.warn(`[ws] unknown message type: ${type}`);
      }
    });

    socket.on('close', () => {
      state.clients.delete(clientId);
      fastify.log.info(`[ws] disconnect ${clientId}`);
      broadcastClientList();
    });

    socket.on('error', (err) => {
      fastify.log.error(`[ws] error ${clientId}: ${err.message}`);
    });
  });

  // Garbage collector des clients zombies (heartbeat manqué > 60s)
  setInterval(() => {
    const cutoff = now() - 60_000;
    for (const [id, c] of state.clients) {
      if (c.lastPing < cutoff && c.socket.readyState !== 1) {
        state.clients.delete(id);
      }
    }
  }, 30_000);

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`🚀 PoC timer-sync en écoute sur http://${HOST}:${PORT}`);
    fastify.log.info(`   Coach  : http://localhost:${PORT}/coach`);
    fastify.log.info(`   TV     : http://localhost:${PORT}/tv`);
    fastify.log.info(`   Drift  : http://localhost:${PORT}/drift`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
