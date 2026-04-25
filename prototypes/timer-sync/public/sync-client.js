// ============================================================
// sync-client.js — Librairie partagée par toutes les pages clients
// ------------------------------------------------------------
// - Gère la connexion WebSocket avec reconnexion exponentielle
// - Calcule l'offset d'horloge via un pattern NTP simplifié
// - Expose un EventTarget pour recevoir les messages
// ============================================================

export class SyncClient extends EventTarget {
  constructor({ role, label }) {
    super();
    this.role = role;
    this.label = label;
    this.clientId = null;
    this.socket = null;
    this.connected = false;
    this._reconnectAttempts = 0;
    this._heartbeatInterval = null;
    this._clockSyncInterval = null;
    this._shouldReconnect = true;

    // État de l'offset d'horloge. offset = serverTime - clientTime
    // Donc serverTime ≈ clientTime + offset
    this.clockOffsetMs = 0;
    this.clockRttMs = 0;
    this.clockSamples = []; // historique des mesures

    this._url = this._buildWsUrl();
  }

  _buildWsUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  connect() {
    this._shouldReconnect = true;
    this._open();
  }

  disconnect() {
    this._shouldReconnect = false;
    clearInterval(this._heartbeatInterval);
    clearInterval(this._clockSyncInterval);
    if (this.socket) this.socket.close();
  }

  _open() {
    this.socket = new WebSocket(this._url);

    this.socket.addEventListener('open', () => {
      this.connected = true;
      this._reconnectAttempts = 0;
      this._log('WS ouvert');
      this.dispatchEvent(new CustomEvent('connection', { detail: { connected: true } }));
      this.send('REGISTER', { role: this.role, label: this.label });
      this._startClockSync();
      this._startHeartbeat();
    });

    this.socket.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      this._handleMessage(msg);
    });

    this.socket.addEventListener('close', () => {
      this.connected = false;
      clearInterval(this._heartbeatInterval);
      clearInterval(this._clockSyncInterval);
      this._log('WS fermé');
      this.dispatchEvent(new CustomEvent('connection', { detail: { connected: false } }));
      if (this._shouldReconnect) this._scheduleReconnect();
    });

    this.socket.addEventListener('error', () => {
      this._log('WS erreur');
    });
  }

  _scheduleReconnect() {
    this._reconnectAttempts++;
    const delay = Math.min(30_000, 1000 * Math.pow(2, this._reconnectAttempts - 1));
    this._log(`Reconnexion dans ${delay}ms (tentative ${this._reconnectAttempts})`);
    setTimeout(() => {
      if (this._shouldReconnect) this._open();
    }, delay);
  }

  send(type, payload = {}) {
    if (!this.socket || this.socket.readyState !== 1) return false;
    this.socket.send(JSON.stringify({ type, payload }));
    return true;
  }

  _handleMessage(msg) {
    const { type, payload } = msg;
    switch (type) {
      case 'WELCOME':
        this.clientId = payload.clientId;
        this._log(`Client ID : ${this.clientId}`);
        break;
      case 'CLOCK_PONG':
        this._processClockPong(payload);
        break;
      case 'HEARTBEAT_ACK':
        // no-op
        break;
      default:
        this.dispatchEvent(new CustomEvent('message', { detail: { type, payload } }));
        this.dispatchEvent(new CustomEvent(type, { detail: payload }));
    }
  }

  // ========================================
  // Clock sync (NTP-like simplifié)
  // ========================================
  // Le client envoie son t0 (clientT0).
  // Le serveur retourne t1 (réception) et t2 (envoi) - considérés égaux dans notre cas simple.
  // Le client note t3 (réception).
  //
  // rtt = (t3 - t0) - (t2 - t1)    // exclut le temps serveur
  // offset = ((t1 - t0) + (t2 - t3)) / 2
  //
  // On échantillonne plusieurs fois et on garde l'offset médian
  // (robuste aux valeurs aberrantes dues à un lag réseau ponctuel).

  _startClockSync() {
    // Rafale initiale : 7 ping rapprochés
    this.clockSamples = [];
    let burst = 0;
    const burstInterval = setInterval(() => {
      this._sendClockPing();
      burst++;
      if (burst >= 7) {
        clearInterval(burstInterval);
      }
    }, 200);

    // Ensuite : 1 ping toutes les 10 secondes pour dériver
    this._clockSyncInterval = setInterval(() => this._sendClockPing(), 10_000);
  }

  _sendClockPing() {
    this.send('CLOCK_PING', { clientT0: Date.now() });
  }

  _processClockPong({ clientT0, serverT1, serverT2 }) {
    const t3 = Date.now();
    const rtt = (t3 - clientT0) - (serverT2 - serverT1);
    const offset = ((serverT1 - clientT0) + (serverT2 - t3)) / 2;

    this.clockSamples.push({ offset, rtt });
    // Garder les 20 dernières mesures
    if (this.clockSamples.length > 20) this.clockSamples.shift();

    // Calcul médian robuste sur les 10 mesures au RTT le plus faible
    const best = [...this.clockSamples]
      .sort((a, b) => a.rtt - b.rtt)
      .slice(0, Math.min(10, this.clockSamples.length));

    const offsets = best.map((s) => s.offset).sort((a, b) => a - b);
    const median = offsets[Math.floor(offsets.length / 2)];
    const rtts = best.map((s) => s.rtt).sort((a, b) => a - b);
    const medianRtt = rtts[Math.floor(rtts.length / 2)];

    this.clockOffsetMs = median;
    this.clockRttMs = medianRtt;

    this.dispatchEvent(new CustomEvent('clock', {
      detail: {
        offsetMs: this.clockOffsetMs,
        rttMs: this.clockRttMs,
        samples: this.clockSamples.length,
      }
    }));
  }

  _startHeartbeat() {
    this._heartbeatInterval = setInterval(() => {
      this.send('HEARTBEAT', { t: Date.now() });
    }, 15_000);
  }

  // ========================================
  // API publique : convertit temps serveur → temps local
  // ========================================

  // Renvoie le temps serveur estimé (ms epoch)
  serverNow() {
    return Date.now() + this.clockOffsetMs;
  }

  // Étant donné un timestamp serveur absolu (phaseEndsAt),
  // renvoie le temps restant en ms en se basant sur l'horloge locale corrigée.
  remainingMsUntil(serverTimestampMs) {
    return serverTimestampMs - this.serverNow();
  }

  _log(...args) {
    console.log(`[sync:${this.role}]`, ...args);
  }
}
