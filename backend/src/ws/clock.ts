// ============================================================
// Sync d'horloge NTP-like
// Client envoie CLOCK_PING{clientT0}, serveur répond CLOCK_PONG
// avec serverT1 (réception) et serverT2 (envoi réponse).
// Le client calcule : offset = ((T1-T0) + (T2-T3)) / 2
//                     rtt    = (T3-T0) - (T2-T1)
// ============================================================

import type { ConnectedClient } from './hub.js';
import { hub } from './hub.js';

export function handleClockPing(client: ConnectedClient, clientT0: number): void {
  const serverT1 = Date.now();
  const serverT2 = Date.now();

  hub.send(client, {
    type: 'CLOCK_PONG',
    clientT0,
    serverT1,
    serverT2,
  });
}
