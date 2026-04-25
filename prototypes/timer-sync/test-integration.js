// Test d'intégration : simule 3 clients (1 coach + 2 TV) connectés simultanément,
// démarre une session, mesure la dérive entre les 2 TV.

const { WebSocket } = require('ws');

const WS_URL = 'ws://127.0.0.1:3000/ws';

function createClient(role, label) {
  const ws = new WebSocket(WS_URL);
  const state = {
    ws, role, label, clientId: null, offsetMs: 0, rttMs: 0,
    samples: [], session: null,
  };

  const send = (type, payload = {}) =>
    ws.send(JSON.stringify({ type, payload }));

  ws.on('open', () => {
    send('REGISTER', { role, label });
    // Burst de clock ping
    let n = 0;
    const burst = setInterval(() => {
      send('CLOCK_PING', { clientT0: Date.now() });
      n++;
      if (n >= 10) clearInterval(burst);
    }, 100);
  });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'WELCOME') state.clientId = msg.payload.clientId;
    if (msg.type === 'CLOCK_PONG') {
      const t3 = Date.now();
      const { clientT0, serverT1, serverT2 } = msg.payload;
      const rtt = (t3 - clientT0) - (serverT2 - serverT1);
      const offset = ((serverT1 - clientT0) + (serverT2 - t3)) / 2;
      state.samples.push({ offset, rtt });
      // Médiane sur les 5 meilleurs RTT
      const best = [...state.samples].sort((a,b)=>a.rtt-b.rtt).slice(0, 5);
      const offsets = best.map(s=>s.offset).sort((a,b)=>a-b);
      const rtts = best.map(s=>s.rtt).sort((a,b)=>a-b);
      state.offsetMs = offsets[Math.floor(offsets.length/2)];
      state.rttMs = rtts[Math.floor(rtts.length/2)];
    }
    if (msg.type === 'SESSION_UPDATE') state.session = msg.payload;
  });

  state.send = send;
  return state;
}

(async () => {
  console.log('--- Lancement test intégration ---');
  const coach = createClient('coach', 'Coach-Test');
  const tv1 = createClient('tv', 'TV-1');
  const tv2 = createClient('tv', 'TV-2');

  // Attendre la connexion + clock sync
  await new Promise(r => setTimeout(r, 2000));

  console.log(`Coach offset: ${coach.offsetMs.toFixed(2)}ms rtt: ${coach.rttMs.toFixed(2)}ms (${coach.samples.length} samples)`);
  console.log(`TV-1  offset: ${tv1.offsetMs.toFixed(2)}ms rtt: ${tv1.rttMs.toFixed(2)}ms (${tv1.samples.length} samples)`);
  console.log(`TV-2  offset: ${tv2.offsetMs.toFixed(2)}ms rtt: ${tv2.rttMs.toFixed(2)}ms (${tv2.samples.length} samples)`);

  // Démarrer la session
  console.log('\n→ Coach envoie START');
  coach.send('START');

  // Attendre que la session arrive aux TV
  await new Promise(r => setTimeout(r, 500));

  // Mesurer la dérive : même phaseEndsAt serveur, 
  // remaining calculé localement avec leur offset propre
  const measurements = [];
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (!tv1.session || !tv2.session) continue;
    const now = Date.now();
    const t1Remaining = tv1.session.phaseEndsAt - (now + tv1.offsetMs);
    const t2Remaining = tv2.session.phaseEndsAt - (now + tv2.offsetMs);
    const drift = Math.abs(t1Remaining - t2Remaining);
    measurements.push(drift);
    console.log(`[${i+1}/10] TV-1 restant: ${t1Remaining.toFixed(1)}ms · TV-2 restant: ${t2Remaining.toFixed(1)}ms · dérive: ${drift.toFixed(1)}ms`);
  }

  const maxDrift = Math.max(...measurements);
  const avgDrift = measurements.reduce((a,b)=>a+b,0) / measurements.length;
  console.log(`\n=== VERDICT ===`);
  console.log(`Dérive max : ${maxDrift.toFixed(2)} ms`);
  console.log(`Dérive moyenne : ${avgDrift.toFixed(2)} ms`);
  console.log(`Seuil cible : 100 ms`);
  console.log(maxDrift <= 100 ? '✓ PASS (sous le seuil)' : '✗ FAIL (au-dessus du seuil)');

  // Test pause/reprise
  console.log('\n→ Coach envoie PAUSE');
  coach.send('PAUSE');
  await new Promise(r => setTimeout(r, 500));
  console.log(`Session status après pause: ${tv1.session?.status}`);

  console.log('→ Coach envoie RESUME');
  coach.send('RESUME');
  await new Promise(r => setTimeout(r, 500));
  console.log(`Session status après reprise: ${tv1.session?.status}`);

  // Test skip
  const phaseBefore = tv1.session?.currentPhaseIdx;
  console.log(`\n→ Coach envoie SKIP (phase actuelle: ${phaseBefore})`);
  coach.send('SKIP');
  await new Promise(r => setTimeout(r, 300));
  console.log(`Nouvelle phase: ${tv1.session?.currentPhaseIdx}`);

  // Cleanup
  coach.ws.close(); tv1.ws.close(); tv2.ws.close();
  setTimeout(() => process.exit(0), 200);
})();
