// ============================================================
// Client WebSocket réactif (Svelte 5 runes)
// ------------------------------------------------------------
// - Connexion automatique + reconnexion exponentielle
// - Synchronisation d'horloge NTP-like (CLOCK_PING/PONG)
// - Heartbeat toutes les 10 s
// ============================================================

import type { PairConfigPayload } from './tvConfig.js';

const WS_URL = (import.meta.env['VITE_API_URL'] as string | undefined ?? 'http://localhost:3000')
  .replace(/^http/, 'ws') + '/ws';

function getWsAuthToken(role: 'tv' | 'coach' | 'monitor'): string | undefined {
  if (role === 'tv' || typeof localStorage === 'undefined') return undefined;
  return localStorage.getItem('cfitv_token') ?? undefined;
}

// ---- Types publics ----

export type PhaseType = 'WORK' | 'REST' | 'TRANSITION' | 'HYDRATION';

export interface SessionPayload {
  id: string;
  status: 'RUNNING' | 'PAUSED';
  circuitId: string;
  currentPhaseIdx: number;
  totalPhases: number;
  round: number;
  totalRounds: number;
  stationIdx: number;
  phase: { type: PhaseType; label: string; durationMs: number };
  phaseStartsAt: number;
  phaseEndsAt: number;
  pausedAt: number | null;
  remainingOnPauseMs: number | null;
  hydrationBreakEndsAt?: number | null;
}

export interface ClientInfo {
  id:          string;
  role:        string;
  label:       string;
  displayId:   string | null;
  connectedAt: number;
}

// ---- Factory ----

export interface WsConnectionOptions {
  displayId?: string;
  tvSecret?: string;
  onPairConfig?: (config: PairConfigPayload) => void;
}

export function createWsConnection(role: 'tv' | 'coach' | 'monitor', label: string, options: WsConnectionOptions = {}) {
  // Reactive state (Svelte 5 runes — .svelte.ts only)
  let connected = $state(false);
  let session = $state<SessionPayload | null>(null);
  let clockOffset = $state(0); // serverNow = Date.now() + clockOffset
  let clientList = $state<ClientInfo[]>([]);
  let sessionEndedReason = $state<string | null>(null);
  let schedulerFiredAt = $state<number | null>(null); // timestamp dernière session auto

  let ws: WebSocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let clockPingTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 1_000;

  function connect() {
    if (ws) return;
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      connected = true;
      reconnectDelay = 1_000;

      const registerMsg: Record<string, unknown> = { type: 'REGISTER', role, label };
      if (options.displayId) registerMsg['displayId'] = options.displayId;
      if (options.tvSecret) registerMsg['tvSecret'] = options.tvSecret;
      const authToken = getWsAuthToken(role);
      if (authToken) registerMsg['authToken'] = authToken;
      ws!.send(JSON.stringify(registerMsg));

      // Heartbeat toutes les 10 s
      heartbeatTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'HEARTBEAT', t: Date.now() }));
        }
      }, 10_000);

      // Premier ping d'horloge (légèrement différé pour laisser WELCOME arriver)
      setTimeout(() => {
        sendPing();
        clockPingTimer = setInterval(sendPing, 30_000);
      }, 300);
    };

    ws.onmessage = (ev) => {
      try { handleMsg(JSON.parse(ev.data as string) as Record<string, unknown>); }
      catch { /* JSON invalide, on ignore */ }
    };

    ws.onclose = () => onClose();
    ws.onerror = () => ws?.close();
  }

  function sendPing() {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'CLOCK_PING', clientT0: Date.now() }));
    }
  }

  function handleMsg(msg: Record<string, unknown>) {
    switch (msg['type']) {
      case 'CLOCK_PONG': {
        const t3 = Date.now();
        const t0 = msg['clientT0'] as number;
        const t1 = msg['serverT1'] as number;
        const t2 = msg['serverT2'] as number;
        // Formule NTP : offset = ((t1-t0) + (t2-t3)) / 2
        clockOffset = Math.round(((t1 - t0) + (t2 - t3)) / 2);
        break;
      }
      case 'SESSION_UPDATE':
        session = (msg['payload'] as SessionPayload | null) ?? null;
        if (session && !sessionEndedReason) {
          // Détection auto-start : session qui arrive sans que le coach ait envoyé START
          // Le backend envoie SESSION_AUTO_STARTED séparément
        }
        sessionEndedReason = null;
        break;
      case 'SESSION_AUTO_STARTED':
        schedulerFiredAt = Date.now();
        setTimeout(() => { schedulerFiredAt = null; }, 8_000); // masquer après 8s
        break;
      case 'PAIR_CONFIG':
        options.onPairConfig?.({
          displayId: msg['displayId'] as string,
          label: msg['label'] as string,
          stationNumber: msg['stationNumber'] as number,
          screenType: msg['screenType'] as PairConfigPayload['screenType'],
          isLandscape: msg['isLandscape'] as boolean,
          tvSecret: msg['tvSecret'] as string,
          primaryColor: (msg['primaryColor'] as string | undefined) ?? null,
          logoUrl: (msg['logoUrl'] as string | null | undefined) ?? null,
        });
        break;
      case 'SESSION_ENDED':
        session = null;
        sessionEndedReason = (msg['reason'] as string) ?? 'stopped';
        break;
      case 'CLIENT_LIST':
        clientList = (msg['payload'] as ClientInfo[]) ?? [];
        break;
    }
  }

  function onClose() {
    connected = false;
    ws = null;
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (clockPingTimer) { clearInterval(clockPingTimer); clockPingTimer = null; }
    // Reconnexion exponentielle (1 s → 2 s → … → 30 s)
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
        connect();
      }, reconnectDelay);
    }
  }

  /** Temps serveur estimé (epoch ms) */
  function serverNow() { return Date.now() + clockOffset; }

  /** Envoyer un message au serveur */
  function send(msg: Record<string, unknown>) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  /** Libère les ressources (appeler dans onDestroy) */
  function destroy() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (clockPingTimer) clearInterval(clockPingTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
    ws = null;
  }

  connect();

  return {
    get connected()          { return connected; },
    get session()            { return session; },
    get clockOffset()        { return clockOffset; },
    get clientList()         { return clientList; },
    get sessionEndedReason()  { return sessionEndedReason; },
    get schedulerFiredAt()    { return schedulerFiredAt; },
    serverNow,
    send,
    destroy,
  };
}

export type WsConnection = ReturnType<typeof createWsConnection>;
