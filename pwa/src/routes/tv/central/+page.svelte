<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createWsConnection } from '$lib/ws.svelte.js';
  import { circuits as api, type Circuit } from '$lib/api';

  // ---- Setup ----
  let label = $state('TV Centrale');
  let conn = $state<ReturnType<typeof createWsConnection> | null>(null);

  function start() {
    conn?.destroy();
    conn = createWsConnection('monitor', label);
  }
  onDestroy(() => conn?.destroy());

  // ---- Timer ----
  let now = $state(Date.now());
  $effect(() => {
    if (!conn) return;
    const id = setInterval(() => { now = Date.now(); }, 100);
    return () => clearInterval(id);
  });

  // ---- Fetch circuit quand la session démarre ----
  let circuitData = $state<Circuit | null>(null);
  let lastFetchedId = '';

  $effect(() => {
    const cid = conn?.session?.circuitId;
    if (cid && cid !== lastFetchedId) {
      lastFetchedId = cid;
      api.get(cid).then(c => { circuitData = c; });
    }
    if (!cid) { circuitData = null; lastFetchedId = ''; }
  });

  // ---- Dérivés ----
  const session = $derived(conn?.session ?? null);

  const remainingMs = $derived.by(() => {
    if (!session) return 0;
    if (session.status === 'PAUSED') return session.remainingOnPauseMs ?? 0;
    return Math.max(0, session.phaseEndsAt - (now + (conn?.clockOffset ?? 0)));
  });

  const remainingSec = $derived(Math.ceil(remainingMs / 1000));

  const progressFrac = $derived.by(() => {
    if (!session || session.phase.durationMs === 0) return 0;
    const elapsed = session.phase.durationMs - remainingMs;
    return Math.min(1, Math.max(0, elapsed / session.phase.durationMs));
  });

  // ---- Phase config ----
  const PHASE: Record<string, { color: string; bg: string; accent: string; label: string }> = {
    WORK:       { color: '#10b981', bg: '#064e3b', accent: '#34d399', label: 'TRAVAIL'    },
    REST:       { color: '#38bdf8', bg: '#0c4a6e', accent: '#7dd3fc', label: 'REPOS'      },
    TRANSITION: { color: '#fbbf24', bg: '#451a03', accent: '#fcd34d', label: 'TRANSITION' },
  };

  const phaseCfg = $derived(session ? (PHASE[session.phase.type] ?? PHASE['WORK']!) : null);

  // ---- Pause eau ----
  const hydrationRemainingMs = $derived.by(() => {
    const endsAt = session?.hydrationBreakEndsAt;
    if (!endsAt) return 0;
    return Math.max(0, endsAt - (now + (conn?.clockOffset ?? 0)));
  });
  const hydrationRemainingSec = $derived(Math.ceil(hydrationRemainingMs / 1000));

  // Phase HYDRATION (pause programmée) OU pause manuelle coach
  const isHydration    = $derived(session?.phase.type === 'HYDRATION' || hydrationRemainingSec > 0);
  const hydrationCount = $derived(session?.phase.type === 'HYDRATION' ? remainingSec : hydrationRemainingSec);

  // ---- Stations ordonnées + positions ----
  const sortedStations = $derived(
    circuitData
      ? [...circuitData.stations].sort((a, b) => a.position - b.position)
      : []
  );

  // Auto-arrange si pas de layout configuré
  function autoArrange(n: number): Array<{ x: number; y: number }> {
    const cols = n <= 2 ? 2 : n <= 4 ? 2 : n <= 6 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    return Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const xIdx = row % 2 === 0 ? col : (cols - 1 - col);
      return {
        x: 0.08 + xIdx * (0.84 / Math.max(1, cols - 1)),
        y: rows <= 1 ? 0.5 : 0.12 + row * (0.76 / Math.max(1, rows - 1)),
      };
    });
  }

  const stationPositions = $derived.by(() => {
    if (!sortedStations.length) return [];
    const auto = autoArrange(sortedStations.length);
    return sortedStations.map((s, i) => ({
      x: s.layoutX ?? auto[i]!.x,
      y: s.layoutY ?? auto[i]!.y,
      name: s.exercises.map(e => e.exercise.name).join(' / ') || `Station ${i + 1}`,
      isActive: session?.phase.type === 'WORK' || session?.phase.type === 'TRANSITION',
    }));
  });

  // ---- Format time ----
  function fmtTime(sec: number): string {
    if (sec >= 60) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    }
    return String(sec);
  }
</script>

<svelte:head>
  <title>TV Centrale — Circuit Fit TV</title>
</svelte:head>

<style>
  @keyframes dash-flow {
    to { stroke-dashoffset: -12; }
  }
  .arrow-animated {
    animation: dash-flow 0.6s linear infinite;
  }
  @keyframes bottle-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-12px); }
  }
  .water-bottle-anim {
    animation: bottle-float 2s ease-in-out infinite;
  }
</style>

{#if !conn}
  <!-- ══════════ Écran de configuration ══════════ -->
  <div class="min-h-screen bg-slate-950 flex items-center justify-center">
    <div class="w-full max-w-sm px-8 space-y-8">
      <div class="text-center">
        <div class="text-6xl mb-4">🖥️</div>
        <h1 class="text-4xl font-black text-sky-400 tracking-tight">TV Centrale</h1>
        <p class="text-slate-400 mt-2">Vue globale de toutes les stations</p>
      </div>
      <div class="space-y-2">
        <label for="central-label" class="block text-sm font-medium text-slate-300">
          Nom de cet affichage
        </label>
        <input
          id="central-label"
          bind:value={label}
          class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                 text-slate-100 text-lg focus:outline-none focus:border-sky-500 transition-colors"
          placeholder="TV Centrale"
        />
      </div>
      <button
        onclick={start}
        class="w-full py-4 bg-sky-500 hover:bg-sky-400 active:bg-sky-600
               text-white font-bold text-lg rounded-xl transition-colors"
      >
        Démarrer l'affichage
      </button>
    </div>
  </div>

{:else}
  <!-- ══════════ Affichage principal ══════════ -->
  <div class="fixed inset-0 bg-slate-950 flex overflow-hidden select-none">

    <!-- ════ PANNEAU GAUCHE — Infos session (style F45) ════ -->
    <div class="w-64 shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">

      <!-- Logo / titre -->
      <div class="px-5 pt-6 pb-4 border-b border-slate-800">
        <button
          onclick={() => { conn?.destroy(); conn = null; circuitData = null; }}
          class="text-base font-bold text-sky-400 hover:text-sky-300 transition-colors leading-tight"
          title="Déconnecter"
        >
          Circuit Fit TV
        </button>
        {#if circuitData}
          <p class="text-sm text-slate-400 mt-0.5 truncate">{circuitData.name}</p>
        {/if}
      </div>

      {#if session && phaseCfg}
        <!-- Phase badge -->
        <div class="px-5 pt-5">
          <div
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold tracking-widest uppercase"
            style="background: {phaseCfg.bg}; color: {phaseCfg.color};"
          >
            <span
              class="w-2 h-2 rounded-full animate-pulse"
              style="background: {phaseCfg.color};"
            ></span>
            {session.status === 'PAUSED' ? 'PAUSE' : phaseCfg.label}
          </div>
        </div>

        <!-- Exercice en cours -->
        <div class="px-5 pt-4">
          <p class="text-xs text-slate-500 uppercase tracking-widest mb-1">Exercice</p>
          <p class="text-base font-semibold text-slate-200 leading-snug">
            {session.phase.label}
          </p>
        </div>

        <!-- Timer principal -->
        <div class="px-5 pt-6 pb-2">
          <p class="text-xs text-slate-500 uppercase tracking-widest mb-1">Temps restant</p>
          <p
            class="text-7xl font-black tabular-nums leading-none"
            style="color: {phaseCfg.color};"
          >
            {fmtTime(remainingSec)}
          </p>
        </div>

        <!-- Barre de progression phase -->
        <div class="px-5 pb-4">
          <div class="h-1.5 rounded-full bg-slate-800 overflow-hidden mt-3">
            <div
              class="h-full rounded-full transition-[width] duration-150"
              style="width: {progressFrac * 100}%; background: {phaseCfg.color};"
            ></div>
          </div>
        </div>

        <!-- Rounds -->
        <div class="px-5 py-4 border-t border-slate-800">
          <p class="text-xs text-slate-500 uppercase tracking-widest mb-1">Round</p>
          <div class="flex items-baseline gap-1">
            <span class="text-4xl font-black text-slate-100">{session.round}</span>
            <span class="text-lg text-slate-500">/ {session.totalRounds}</span>
          </div>
          <!-- Ronds visuels des rounds -->
          <div class="flex gap-1.5 mt-2 flex-wrap">
            {#each Array(session.totalRounds) as _, r}
              <div
                class="w-3 h-3 rounded-full border transition-colors"
                style="
                  background: {r < session.round - 1 ? phaseCfg.color : r === session.round - 1 ? phaseCfg.color + '60' : 'transparent'};
                  border-color: {r <= session.round - 1 ? phaseCfg.color : '#334155'};
                "
              ></div>
            {/each}
          </div>
        </div>

        <!-- Work / Rest -->
        {#if circuitData}
          <div class="px-5 py-4 border-t border-slate-800 space-y-2">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
              <span class="text-slate-400 text-sm">Travail</span>
              <span class="ml-auto font-bold text-slate-200 tabular-nums">{circuitData.workSec}s</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0"></span>
              <span class="text-slate-400 text-sm">Repos</span>
              <span class="ml-auto font-bold text-slate-200 tabular-nums">{circuitData.restSec}s</span>
            </div>
            {#if circuitData.transitionSec > 0}
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
                <span class="text-slate-400 text-sm">Transition</span>
                <span class="ml-auto font-bold text-slate-200 tabular-nums">{circuitData.transitionSec}s</span>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Statut connexion -->
        <div class="mt-auto px-5 py-4 border-t border-slate-800">
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full"
              style="background: {conn.connected ? '#10b981' : '#ef4444'};"
            ></span>
            <span class="text-xs text-slate-500">
              {conn.connected ? 'LIVE' : 'Reconnexion…'}
            </span>
          </div>
        </div>

      {:else}
        <!-- En attente -->
        <div class="flex-1 flex flex-col items-center justify-center px-5 text-center gap-4">
          <div class="w-16 h-16 rounded-full border-2 border-slate-700 flex items-center justify-center">
            <span class="text-2xl">📡</span>
          </div>
          <p class="text-slate-400 text-sm leading-relaxed">
            En attente d'une session depuis le panneau Coach…
          </p>
          <div class="flex items-center gap-2 mt-2">
            <span
              class="w-2 h-2 rounded-full"
              style="background: {conn.connected ? '#10b981' : '#ef4444'};"
            ></span>
            <span class="text-xs text-slate-500">
              {conn.connected ? 'Connecté' : 'Reconnexion…'}
            </span>
          </div>
        </div>
      {/if}
    </div>

    <!-- ════ PANNEAU DROIT — Carte du gym ════ -->
    <div class="flex-1 flex flex-col overflow-hidden relative">

      {#if session && sortedStations.length > 0}
        <!-- Carte SVG plein écran -->
        <div class="flex-1 relative overflow-hidden p-6">

          <!-- Canvas SVG -->
          <svg
            class="w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- Fond salle -->
            <rect x="1" y="1" width="98" height="98" rx="2"
                  fill="none" stroke="#334155" stroke-width="0.5" stroke-dasharray="3 2"/>

            <!-- Grille subtile -->
            <defs>
              <pattern id="tvgrid" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1e293b" stroke-width="0.5"/>
              </pattern>
            </defs>
            <rect x="1" y="1" width="98" height="98" fill="url(#tvgrid)" />

            <!-- Lignes de connexion entre stations -->
            {#each stationPositions as pos, i}
              {#if i < stationPositions.length - 1}
                {@const next = stationPositions[i + 1]!}
                {@const mx = (pos.x + next.x) / 2 * 100}
                {@const my = (pos.y + next.y) / 2 * 100}
                {@const angle = Math.atan2(next.y - pos.y, next.x - pos.x) * 180 / Math.PI}
                {@const isTransition = session?.phase.type === 'TRANSITION'}
                {@const arrowColor = isTransition ? (phaseCfg?.color ?? '#fbbf24') : '#334155'}
                {@const arrowAccent = isTransition ? (phaseCfg?.accent ?? '#fcd34d') : '#475569'}
                <!-- Ligne -->
                <line
                  x1="{pos.x * 100}" y1="{pos.y * 100}"
                  x2="{next.x * 100}" y2="{next.y * 100}"
                  stroke={arrowColor}
                  stroke-width={isTransition ? 1.5 : 0.6}
                  stroke-dasharray={isTransition ? "4 2" : "2 3"}
                  class={isTransition ? 'arrow-animated' : ''}
                />
                <!-- Flèche directionnelle -->
                <polygon
                  points={isTransition ? "-3,-2 3,0 -3,2" : "-1.5,-1 1.5,0 -1.5,1"}
                  fill={arrowAccent}
                  transform="translate({mx},{my}) rotate({angle})"
                  opacity={isTransition ? 1 : 0.5}
                />
              {/if}
            {/each}

            <!-- Stations -->
            {#each stationPositions as pos, i}
              {@const cx = pos.x * 100}
              {@const cy = pos.y * 100}
              {@const active = pos.isActive}
              {@const isWork = session?.phase.type === 'WORK'}
              {@const isTransition = session?.phase.type === 'TRANSITION'}

              <!-- Halo pulsant pour toutes les stations actives -->
              {#if active && phaseCfg && isWork}
                <circle
                  cx={cx} cy={cy} r="7"
                  fill="none"
                  stroke={phaseCfg.accent}
                  stroke-width="1"
                  opacity="0.4"
                  class="animate-ping"
                  style="transform-origin: {cx}px {cy}px;"
                />
              {/if}

              <!-- Cercle principal -->
              <circle
                cx={cx} cy={cy} r={active ? 5.5 : 4.5}
                fill={active && phaseCfg ? phaseCfg.color : '#1e293b'}
                stroke={active && phaseCfg ? phaseCfg.accent : '#475569'}
                stroke-width={active ? 1.5 : 1}
                opacity={isTransition ? 0.6 : 1}
                class="transition-all duration-300"
              />

              <!-- Numéro de station -->
              <text
                x={cx} y={cy}
                text-anchor="middle"
                dominant-baseline="central"
                font-size={active ? "4" : "3.5"}
                font-weight="700"
                fill={active ? '#fff' : '#94a3b8'}
                opacity={isTransition ? 0.7 : 1}
              >
                {i + 1}
              </text>

              <!-- Label exercice en dessous -->
              {@const shortName = pos.name.length > 18 ? pos.name.slice(0, 16) + '…' : pos.name}
              <text
                x={cx}
                y={cy + (active ? 8 : 7)}
                text-anchor="middle"
                font-size="2.8"
                fill={active ? (phaseCfg?.accent ?? '#94a3b8') : '#64748b'}
                font-weight={active ? '600' : '400'}
                opacity={isTransition ? 0.6 : 1}
              >
                {shortName}
              </text>
            {/each}
          </svg>

          <!-- Légende stations en bas -->
          <div class="absolute bottom-6 left-6 right-6 flex flex-wrap gap-2 justify-center">
            {#each stationPositions as pos, i}
              <div
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                       transition-all duration-300"
                style="
                  background: {pos.isActive && phaseCfg ? phaseCfg.bg : '#1e293b'};
                  border: 1px solid {pos.isActive && phaseCfg ? phaseCfg.color : '#334155'};
                  color: {pos.isActive && phaseCfg ? phaseCfg.accent : '#64748b'};
                "
              >
                <span class="font-bold">{i + 1}</span>
                <span class="max-w-[100px] truncate">{pos.name}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Barre de progression globale en bas -->
        <div class="shrink-0 px-6 pb-4">
          <div class="flex items-center gap-3">
            <div class="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                class="h-full rounded-full transition-[width] duration-150"
                style="width: {(session.currentPhaseIdx / session.totalPhases) * 100}%;
                       background: {phaseCfg?.color ?? '#64748b'};"
              ></div>
            </div>
            <span class="text-xs text-slate-600 tabular-nums whitespace-nowrap">
              {session.currentPhaseIdx + 1} / {session.totalPhases}
            </span>
          </div>
        </div>

      {:else}
        <!-- Attente côté carte -->
        <div class="flex-1 flex items-center justify-center opacity-10">
          <p class="text-4xl font-black tracking-[0.3em] text-white">CIRCUIT FIT TV</p>
        </div>
      {/if}

      <!-- ════ OVERLAY PAUSE EAU ════ -->
      {#if isHydration}
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-8
                    bg-slate-950/92 backdrop-blur-sm z-10">
          <svg viewBox="0 0 80 130" class="w-48 h-auto drop-shadow-2xl water-bottle-anim"
               style="color: #67e8f9;" fill="currentColor">
            <!-- Cap -->
            <rect x="28" y="2" width="24" height="9" rx="3"/>
            <!-- Neck -->
            <path d="M24 11 L56 11 L62 30 L18 30 Z" opacity="0.75"/>
            <!-- Body outline -->
            <rect x="10" y="30" width="60" height="92" rx="12" fill="none"
                  stroke="currentColor" stroke-width="3.5"/>
            <!-- Water fill -->
            <clipPath id="wbclip-central"><rect x="10" y="30" width="60" height="92" rx="12"/></clipPath>
            <rect x="10" y="72" width="60" height="50" opacity="0.3"
                  clip-path="url(#wbclip-central)"/>
            <!-- Shine -->
            <rect x="17" y="38" width="7" height="22" rx="3.5" fill="white" opacity="0.18"/>
            <!-- Bubbles -->
            <circle cx="34" cy="95" r="4" opacity="0.35"/>
            <circle cx="50" cy="105" r="2.5" opacity="0.25"/>
          </svg>
          <div class="text-center space-y-2">
            <p class="text-cyan-300 font-black tracking-[0.4em] uppercase text-3xl">Pause eau</p>
            <p class="font-black tabular-nums leading-none"
               style="font-size: 9rem; color: #67e8f9;
                      text-shadow: 0 0 60px rgba(103,232,249,0.6);">
              {hydrationCount}
            </p>
            <p class="text-cyan-400/60 tracking-widest text-base uppercase">secondes</p>
          </div>
        </div>
      {/if}
    </div>

  </div>
{/if}
