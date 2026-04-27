// ============================================================
// Dispatch des messages WebSocket entrants
// ============================================================

import { ClientMessage } from '@cfitv/shared';
import type { ConnectedClient } from './hub.js';
import { hub } from './hub.js';
import { handleClockPing } from './clock.js';
import { orchestrator } from '../sessions/orchestrator.js';
import { registerPin } from './pair.js';
import { prisma } from '../db.js';

export function handleMessage(client: ConnectedClient, raw: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    hub.send(client, { type: 'ERROR', code: 'INVALID_JSON', message: 'Message non JSON' });
    return;
  }

  const result = ClientMessage.safeParse(parsed);
  if (!result.success) {
    hub.send(client, {
      type: 'ERROR',
      code: 'INVALID_MESSAGE',
      message: result.error.issues[0]?.message ?? 'Message invalide',
    });
    return;
  }

  const msg = result.data;

  switch (msg.type) {
    case 'REGISTER':
      // Déjà géré à la connexion (voir wsPlugin) — ignore si reçu après
      break;

    case 'CLOCK_PING':
      handleClockPing(client, msg.clientT0);
      break;

    case 'HEARTBEAT':
      hub.send(client, { type: 'HEARTBEAT_ACK', serverTime: Date.now() });
      // Mettre à jour lastSeen pour les écrans TV appairés
      if (client.role === 'tv' && client.displayId) {
        prisma.display.update({
          where: { id: client.displayId },
          data:  { lastSeen: new Date() },
        }).catch(() => { /* display peut avoir été supprimé */ });
      }
      break;

    case 'START':
      if (client.role !== 'coach') {
        hub.send(client, { type: 'ERROR', code: 'FORBIDDEN', message: 'Seul le coach peut démarrer' });
        break;
      }
      orchestrator.start(msg.circuitId).catch((err: unknown) => {
        hub.send(client, { type: 'ERROR', code: 'START_FAILED', message: String(err) });
      });
      break;

    case 'PAUSE':
      if (client.role !== 'coach') break;
      orchestrator.pause();
      break;

    case 'RESUME':
      if (client.role !== 'coach') break;
      orchestrator.resume();
      break;

    case 'SKIP':
      if (client.role !== 'coach') break;
      orchestrator.skip();
      break;

    case 'STOP':
      if (client.role !== 'coach') break;
      orchestrator.stop().catch(console.error);
      break;

    case 'ADJUST':
      if (client.role !== 'coach') break;
      orchestrator.adjust(msg.deltaMs);
      break;

    case 'HYDRATION_BREAK':
      if (client.role !== 'coach') break;
      orchestrator.hydrationBreak(msg.durationMs);
      break;

    case 'DRIFT_REPORT':
      // Relayer au coach et aux monitors
      hub.broadcastToCoaches({
        type: 'DRIFT_DATA',
        clientId: client.id,
        label: client.label,
        phaseEndsAt: msg.phaseEndsAt,
        remainingMs: msg.remainingMs,
        displayedSec: msg.displayedSec,
        offsetMs: msg.offsetMs,
        rttMs: msg.rttMs,
        clientNow: msg.clientNow,
      });
      break;

    case 'PAIR_REGISTER':
      registerPin(msg.pin, client);
      break;
  }
}
