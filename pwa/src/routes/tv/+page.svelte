<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { createWsConnection, type WsConnection } from '$lib/ws.svelte.js';
  import { circuits as api, type Circuit, type Exercise } from '$lib/api';
  import { studioSettings, loadSettings, applyBranding } from '$lib/settings.svelte.js';
  import {
    clearTvConfig,
    loadTvConfig,
    saveTvConfig,
    screenRouteFor,
    type PairConfigPayload,
    type TvConfig,
  } from '$lib/tvConfig.js';
  import {
    loadTvCircuitSnapshot,
    loadTvSessionSnapshot,
    saveTvCircuitSnapshot,
  } from '$lib/tvOffline.js';

  onMount(async () => {
    await loadSettings();
    const config = loadTvConfig();
    if (config) resumeConfig(config);
    applyBranding();
  });

  // ════ Configuration ════
  let screenType    = $state<'station' | 'dashboard' | 'schedule'>('station');
  let label         = $state('Station 1');
  let stationNumber = $state(1);          // 1-basé → correspond à circuit.stations[n-1]
  let orientation   = $state<'landscape' | 'portrait'>('landscape');
  let conn          = $state<WsConnection | null>(null);
  let savedConfig   = $state<TvConfig | null>(null);
  let pairingPin    = $state('');
  let pairConn      = $state<WsConnection | null>(null);
  let offlineMode   = $state(false);

  function applyConfig(config: TvConfig) {
    savedConfig = config;
    label = config.label;
    stationNumber = config.stationNumber;
    screenType = config.mode === 'central' ? 'dashboard' : config.mode;
    orientation = config.isLandscape ? 'landscape' : 'portrait';
  }

  function resumeConfig(config: TvConfig) {
    applyConfig(config);
    const cachedSession = loadTvSessionSnapshot();
    if (cachedSession) {
      offlineMode = true;
      lastFetchedId = cachedSession.circuitId;
      circuitData = loadTvCircuitSnapshot<Circuit>();
    }
    const route = screenRouteFor(config);
    if (route !== '/tv') {
      goto(route);
      return;
    }
    conn?.destroy();
    conn = createWsConnection('tv', config.label, {
      displayId: config.displayId,
      tvSecret: config.tvSecret,
    });
  }

  function start() {
    if (screenType === 'dashboard') {
      goto('/tv/central');
      return;
    }
    if (screenType === 'schedule') {
      goto('/tv/schedule');
      return;
    }
    conn?.destroy();
    conn = createWsConnection('tv', label, savedConfig?.mode === 'station' ? {
      displayId: savedConfig.displayId,
      tvSecret: savedConfig.tvSecret,
    } : {});
  }

  function handlePairConfig(payload: PairConfigPayload) {
    const config = saveTvConfig(payload);
    pairConn?.destroy();
    pairConn = null;
    pairingPin = '';
    applyConfig(config);

    const route = screenRouteFor(config);
    if (route !== '/tv') {
      goto(route);
      return;
    }

    conn?.destroy();
    conn = createWsConnection('tv', config.label, {
      displayId: config.displayId,
      tvSecret: config.tvSecret,
    });
  }

  function startPairing() {
    pairingPin = String(Math.floor(1000 + Math.random() * 9000));
    pairConn?.destroy();
    pairConn = createWsConnection('tv', 'PWA TV en appairage', {
      onPairConfig: handlePairConfig,
    });
  }

  function cancelPairing() {
    pairConn?.destroy();
    pairConn = null;
    pairingPin = '';
  }

  function forgetSavedConfig() {
    clearTvConfig();
    savedConfig = null;
    conn?.destroy();
    conn = null;
    label = 'Station 1';
    stationNumber = 1;
    screenType = 'station';
    orientation = 'landscape';
  }

  $effect(() => {
    if (!pairConn?.connected || !pairingPin) return;
    pairConn.send({
      type: 'PAIR_REGISTER',
      pin: pairingPin,
      deviceModel: 'PWA TV',
      deviceOs: navigator.userAgent,
      appVersion: 'pwa',
    });
  });

  onDestroy(() => conn?.destroy());
  onDestroy(() => pairConn?.destroy());

  // ════ Fetch circuit quand session démarre ════
  let circuitData  = $state<Circuit | null>(null);
  let lastFetchedId = '';

  $effect(() => {
    const cid = conn?.session?.circuitId;
    if (cid && cid !== lastFetchedId) {
      lastFetchedId = cid;
      api.get(cid).then(c => {
        circuitData = c;
        offlineMode = false;
        saveTvCircuitSnapshot(c);
      }).catch(() => {
        circuitData = loadTvCircuitSnapshot<Circuit>();
        offlineMode = true;
      });
    }
    if (!cid && !offlineMode) { circuitData = null; lastFetchedId = ''; }
  });

  // ════ Timer ════
  let now = $state(Date.now());
  $effect(() => {
    if (!conn) return;
    const id = setInterval(() => { now = Date.now(); }, 100);
    return () => clearInterval(id);
  });

  // ════ Dérivés session ════
  const session = $derived(conn?.session ?? (offlineMode ? loadTvSessionSnapshot() : null));

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

  // ════ État de la station ════
  const myStationIdx = $derived(stationNumber - 1);

  // En circuit training, toutes les stations travaillent simultanément
  const isMyWork = $derived(session?.phase.type === 'WORK');

  // Exercices assignés à cette station dans le circuit
  const myExercises = $derived.by((): Exercise[] => {
    if (!circuitData) return [];
    const sorted = [...circuitData.stations].sort((a, b) => a.position - b.position);
    const st = sorted[myStationIdx];
    return st ? st.exercises.map(e => e.exercise) : [];
  });

  // ════ Pause eau ════
  const hydrationRemainingMs = $derived.by(() => {
    const endsAt = session?.hydrationBreakEndsAt;
    if (!endsAt) return 0;
    return Math.max(0, endsAt - (now + (conn?.clockOffset ?? 0)));
  });
  const hydrationRemainingSec = $derived(Math.ceil(hydrationRemainingMs / 1000));

  // Pause programmée (phase HYDRATION) OU pause manuelle coach
  const isHydration    = $derived(session?.phase.type === 'HYDRATION' || hydrationRemainingSec > 0);
  const hydrationCount = $derived(session?.phase.type === 'HYDRATION' ? remainingSec : hydrationRemainingSec);
  const isGlobalPhase  = $derived(session?.phase.type === 'WARMUP' || session?.phase.type === 'COOLDOWN');

  // ════ Couleurs ════
  type PhaseCfg = { bg: string; dim: string; accent: string; label: string };
  const PHASE: Record<string, PhaseCfg> = {
    WARMUP:     { bg: '#be123c', dim: '#881337', accent: '#fda4af', label: 'WARMUP'     },
    WORK:       { bg: '#059669', dim: '#065f46', accent: '#34d399', label: 'TRAVAIL'    },
    REST:       { bg: '#0369a1', dim: '#075985', accent: '#7dd3fc', label: 'REPOS'      },
    TRANSITION: { bg: '#d97706', dim: '#92400e', accent: '#fcd34d', label: 'TRANSITION' },
    HYDRATION:  { bg: '#0891b2', dim: '#155e75', accent: '#67e8f9', label: 'PAUSE EAU'  },
    COOLDOWN:   { bg: '#7c3aed', dim: '#5b21b6', accent: '#ddd6fe', label: 'COOLDOWN'   },
    WAIT:       { bg: '#0f172a', dim: '#1e293b', accent: '#475569', label: 'ATTENTE'    },
  };

  const phaseCfg = $derived.by((): PhaseCfg => {
    if (!session) return PHASE['WAIT']!;
    return PHASE[session.phase.type] ?? PHASE['WORK']!;
  });

  // ════ Grille d'exercices ════
  // Retourne les classes CSS grid-cols-* selon nombre d'exercices + orientation
  function gridCols(n: number, orient: 'landscape' | 'portrait'): string {
    if (orient === 'portrait') {
      if (n <= 2) return 'grid-cols-1';
      return 'grid-cols-2';
    }
    // landscape
    if (n === 1) return 'grid-cols-1';
    if (n <= 2) return 'grid-cols-2';
    if (n <= 3) return 'grid-cols-3';
    if (n <= 4) return 'grid-cols-2';
    if (n <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  }

  // Taille de texte du nom selon nombre d'exercices
  function nameFontSize(n: number): string {
    if (n === 1) return 'text-5xl';
    if (n <= 2) return 'text-4xl';
    if (n <= 4) return 'text-2xl';
    return 'text-xl';
  }

  // Format seconds → m:ss ou juste ss
  function fmtTime(sec: number): string {
    if (sec >= 60) return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    return String(sec);
  }
</script>

<svelte:head>
  <title>TV Station — Circuit Fit TV</title>
</svelte:head>

{#if !conn}
  <!-- ════════════════════════════════════
       Écran de configuration
       ════════════════════════════════════ -->
  <div class="min-h-screen bg-slate-950 flex items-center justify-center">
    <div class="w-full max-w-md px-8 space-y-8">

      <div class="text-center">
        {#if studioSettings.logoUrl}
          <img src={studioSettings.logoUrl} alt="Logo" class="h-16 w-auto object-contain mx-auto mb-3" />
        {:else}
          <div class="text-6xl mb-4">📺</div>
        {/if}
        <h1 class="text-4xl font-black tracking-tight" style="color: var(--color-primary, #0ea5e9);">
          {studioSettings.studioName}
        </h1>
        <p class="text-slate-400 mt-2">Configuration de l'écran station</p>
      </div>

      <div class="space-y-5">
        {#if savedConfig}
          <div class="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-4 py-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-bold text-emerald-300">Écran appairé</p>
                <p class="text-xs text-emerald-100/70 mt-0.5">
                  {savedConfig.label} · {savedConfig.screenType}
                </p>
              </div>
              <button
                type="button"
                onclick={forgetSavedConfig}
                class="text-xs font-semibold text-emerald-200/80 hover:text-white"
              >
                Oublier
              </button>
            </div>
          </div>
        {/if}

        <div class="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 space-y-3">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-bold text-slate-200">Appairage console</p>
              <p class="text-xs text-slate-500 mt-0.5">Génère un PIN visible dans l'admin.</p>
            </div>
            {#if pairingPin}
              <button
                type="button"
                onclick={cancelPairing}
                class="text-xs font-semibold text-slate-400 hover:text-slate-100"
              >
                Annuler
              </button>
            {:else}
              <button
                type="button"
                onclick={startPairing}
                class="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs font-bold hover:bg-slate-700"
              >
                Obtenir un code
              </button>
            {/if}
          </div>
          {#if pairingPin}
            <div class="flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-4 py-3">
              <div>
                <p class="text-xs uppercase tracking-widest text-slate-500">Code PIN</p>
                <p class="text-4xl font-black tabular-nums text-sky-300 leading-none mt-1">{pairingPin}</p>
              </div>
              <p class="text-xs text-right {pairConn?.connected ? 'text-emerald-400' : 'text-amber-400'}">
                {pairConn?.connected ? 'En attente admin' : 'Connexion...'}
              </p>
            </div>
          {/if}
        </div>

        <!-- Type d'écran -->
        <div class="space-y-1.5">
          <p class="text-sm font-medium text-slate-300">Type d'écran</p>
          <div class="grid grid-cols-3 gap-3">
            {#each [
              { value: 'station',   icon: '🏋️', label: 'Station',   desc: 'Exercices & timer'  },
              { value: 'dashboard', icon: '📊', label: 'Dashboard',  desc: 'Vue d\'ensemble'     },
              { value: 'schedule',  icon: '📅', label: 'Calendrier', desc: 'Horaire des cours'   },
            ] as opt}
              <button
                onclick={() => {
                  screenType = opt.value as 'station' | 'dashboard' | 'schedule';
                  label = opt.value === 'dashboard'
                    ? 'Dashboard'
                    : opt.value === 'schedule'
                      ? 'Calendrier'
                      : 'Station 1';
                }}
                class="flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl border-2 transition-all
                       {screenType === opt.value
                         ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                         : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}"
              >
                <span class="text-2xl">{opt.icon}</span>
                <span class="font-semibold text-sm">{opt.label}</span>
                <span class="text-xs opacity-70">{opt.desc}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Nom / label -->
        <div class="space-y-1.5">
          <label for="tv-label" class="block text-sm font-medium text-slate-300">
            Nom de cet écran
          </label>
          <input
            id="tv-label"
            bind:value={label}
            class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                   text-slate-100 text-lg focus:outline-none focus:border-sky-500 transition-colors"
            placeholder="Ex : Station 1"
          />
        </div>

        {#if screenType === 'station'}
          <!-- Numéro de station -->
          <div class="space-y-1.5">
            <label for="tv-station" class="block text-sm font-medium text-slate-300">
              Numéro de station dans le circuit
            </label>
            <div class="flex items-center gap-3">
              <input
                id="tv-station"
                type="number"
                min="1"
                max="20"
                bind:value={stationNumber}
                class="w-24 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                       text-slate-100 text-xl font-bold text-center
                       focus:outline-none focus:border-sky-500 transition-colors"
              />
              <p class="text-slate-400 text-sm">
                Cet écran affiche les exercices de la station&nbsp;{stationNumber} du circuit.
              </p>
            </div>
          </div>

          <!-- Orientation -->
          <div class="space-y-1.5">
            <p class="text-sm font-medium text-slate-300">Orientation de l'écran</p>
            <div class="grid grid-cols-2 gap-3">
              {#each [
                { value: 'landscape', icon: '▬', label: 'Paysage',  desc: 'TV horizontale' },
                { value: 'portrait',  icon: '▮', label: 'Portrait', desc: 'TV verticale'    },
              ] as opt}
                <button
                  onclick={() => { orientation = opt.value as 'landscape' | 'portrait'; }}
                  class="flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all
                         {orientation === opt.value
                           ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                           : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}"
                >
                  <span class="text-3xl">{opt.icon}</span>
                  <span class="font-semibold">{opt.label}</span>
                  <span class="text-xs opacity-70">{opt.desc}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

      </div>

      <button
        onclick={start}
        class="w-full py-4 text-white font-bold text-lg rounded-xl transition-colors"
        style="background: var(--color-primary, #0ea5e9);"
      >
        Démarrer l'affichage
      </button>
    </div>
  </div>

{:else}
  <!-- ════════════════════════════════════
       Écran d'affichage station
       ════════════════════════════════════ -->
  <div
    class="fixed inset-0 flex flex-col select-none overflow-hidden"
    style="background-color: {phaseCfg.bg}; transition: background-color 600ms ease;"
  >

    <!-- ── Header ── -->
    <div class="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
      <button
        onclick={() => { conn?.destroy(); conn = null; }}
        class="flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity"
        title="Retour à la configuration"
      >
        {#if studioSettings.logoUrl}
          <img src={studioSettings.logoUrl} alt="Logo"
               class="h-8 w-auto object-contain" style="filter: brightness(0) invert(1);" />
        {/if}
        <span class="text-lg font-bold">{label}</span>
      </button>

      <div class="flex items-center gap-4 text-sm opacity-60">
        {#if session}
          <span class="font-bold tracking-widest uppercase">
            {phaseCfg.label}
          </span>
          <span class="opacity-40">·</span>
          <span>R {session.round}/{session.totalRounds}</span>
          <span class="opacity-40">·</span>
        {/if}
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block w-2 h-2 rounded-full"
            style="background: {conn.connected ? phaseCfg.accent : '#ef4444'};
                   animation: {conn.connected ? 'cfpulse 2s ease-in-out infinite' : 'none'};"
          ></span>
          {conn.connected ? 'LIVE' : 'Reconnexion…'}
        </span>
        {#if offlineMode || !conn.connected}
          <span class="text-amber-200 font-bold">Mode cache</span>
        {/if}
      </div>
    </div>

    <!-- ── Contenu principal ── -->
    <div class="flex-1 flex overflow-hidden min-h-0">

      {#if session}

        {#if isHydration}
          <!-- ══ PAUSE EAU ══ -->
          <div class="flex-1 flex flex-col items-center justify-center gap-6"
               style="background: rgba(0,0,0,0.5);">
            <svg viewBox="0 0 80 130" class="w-40 h-auto drop-shadow-lg water-bottle-anim"
                 style="color: #67e8f9;" fill="currentColor">
              <rect x="28" y="2" width="24" height="9" rx="3"/>
              <path d="M24 11 L56 11 L62 30 L18 30 Z" opacity="0.75"/>
              <rect x="10" y="30" width="60" height="92" rx="12" fill="none"
                    stroke="currentColor" stroke-width="3.5"/>
              <clipPath id="wbclip"><rect x="10" y="30" width="60" height="92" rx="12"/></clipPath>
              <rect x="10" y="72" width="60" height="50" opacity="0.3" clip-path="url(#wbclip)"/>
              <rect x="17" y="38" width="7" height="22" rx="3.5" fill="white" opacity="0.18"/>
              <circle cx="34" cy="95" r="4" opacity="0.35"/>
              <circle cx="50" cy="105" r="2.5" opacity="0.25"/>
            </svg>
            <div class="text-center space-y-1">
              <p class="text-cyan-300 font-black tracking-[0.3em] uppercase text-2xl">Pause eau</p>
              <p class="text-8xl font-black tabular-nums leading-none"
                 style="color: #67e8f9; text-shadow: 0 0 40px rgba(103,232,249,0.5);">
                {hydrationCount}
              </p>
              <p class="text-cyan-400/60 tracking-widest text-sm uppercase">secondes</p>
            </div>
          </div>

        {:else if isGlobalPhase}
          <!-- ══ WARMUP / COOLDOWN ══ -->
          <div class="flex-1 flex flex-col items-center justify-center gap-5 text-center px-10"
               style="background: rgba(0,0,0,0.35);">
            <p class="text-2xl font-black tracking-[0.25em] uppercase opacity-70">{phaseCfg.label}</p>
            <p class="text-9xl font-black tabular-nums leading-none"
               style="color: {phaseCfg.accent}; text-shadow: 0 0 40px rgba(255,255,255,0.18);">
              {fmtTime(remainingSec)}
            </p>
            <p class="text-5xl font-black leading-tight">{session.phase.label}</p>
            {#if circuitData?.coachNotes}
              <p class="max-w-4xl text-2xl leading-snug opacity-80">{circuitData.coachNotes}</p>
            {/if}
          </div>

        {:else if isMyWork || session.phase.type !== 'WORK'}
          <!-- ── MODE ACTIF : exercices de cette station ── -->

          <!-- Timer latéral (paysage) ou en haut (portrait) -->
          {#if orientation === 'landscape'}
            <div class="flex flex-col items-center justify-center w-52 shrink-0 px-6 gap-2">
              <p class="text-xs font-bold tracking-[0.2em] uppercase opacity-50 mb-1">
                {phaseCfg.label}
              </p>
              <p
                class="font-black tabular-nums leading-none"
                style="font-size: clamp(3rem, 7vw, 6rem); color: {phaseCfg.accent};"
              >
                {fmtTime(remainingSec)}
              </p>
              <p class="text-sm tracking-widest uppercase opacity-40">sec</p>
              {#if session.status === 'PAUSED'}
                <p class="text-xs font-bold tracking-widest opacity-70 mt-1">⏸ PAUSE</p>
              {/if}
            </div>

            <!-- Séparateur -->
            <div class="w-px shrink-0 my-8" style="background: rgba(255,255,255,0.1);"></div>
          {:else}
            <!-- Portrait : timer compact en haut -->
            <div class="hidden"></div>
          {/if}

          <!-- Grille d'exercices -->
          <div class="flex-1 p-4 overflow-hidden">
            {#if orientation === 'portrait'}
              <!-- Timer compact en portrait -->
              <div class="flex items-center justify-center gap-4 mb-4">
                <p class="text-xs font-bold tracking-[0.2em] uppercase opacity-50">{phaseCfg.label}</p>
                <p
                  class="font-black tabular-nums"
                  style="font-size: clamp(2rem, 8vw, 4rem); color: {phaseCfg.accent};"
                >
                  {fmtTime(remainingSec)}
                </p>
              </div>
            {/if}

            {#if myExercises.length > 0}
              <div
                class="h-full grid gap-3 {gridCols(myExercises.length, orientation)}"
                style="grid-auto-rows: {orientation === 'portrait' ? 'auto' : '1fr'};"
              >
                {#each myExercises as ex}
                  <div
                    class="relative rounded-2xl overflow-hidden flex flex-col"
                    style="background: rgba(0,0,0,0.25);"
                  >
                    <!-- Thumbnail en fond -->
                    {#if ex.thumbnailUrl}
                      <img
                        src={ex.thumbnailUrl}
                        alt=""
                        class="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        style="opacity: 0.3;"
                      />
                    {/if}

                    <!-- Contenu de la carte -->
                    <div class="relative z-10 flex-1 flex flex-col items-center justify-center
                                p-4 text-center gap-2">
                      <p
                        class="font-black leading-tight {nameFontSize(myExercises.length)}"
                        style="text-shadow: 0 2px 8px rgba(0,0,0,0.5);"
                      >
                        {ex.name}
                      </p>

                      {#if ex.muscleGroups.length > 0 && myExercises.length <= 4}
                        <p class="text-sm opacity-60 font-medium">
                          {ex.muscleGroups.join(' · ')}
                        </p>
                      {/if}

                      {#if ex.equipment.length > 0 && myExercises.length <= 2}
                        <div class="flex flex-wrap gap-1.5 justify-center mt-1">
                          {#each ex.equipment as eq}
                            <span
                              class="text-xs px-2 py-0.5 rounded-full font-medium"
                              style="background: rgba(0,0,0,0.3);"
                            >
                              {eq}
                            </span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <!-- Pas encore de data circuit -->
              <div class="h-full flex flex-col items-center justify-center gap-3 opacity-50">
                <p class="{nameFontSize(1)} font-black">{session.phase.label}</p>
                <p class="text-sm tracking-widest uppercase">Chargement du circuit…</p>
              </div>
            {/if}
          </div>

        {/if}

      {:else}
        <!-- ── Pas de session active ── -->
        <div class="flex-1 flex flex-col items-center justify-center gap-4 opacity-25">
          <p class="text-5xl font-black tracking-widest">STATION {stationNumber}</p>
          <p class="text-xl tracking-wide">En attente d'une session…</p>
        </div>
      {/if}
    </div>

    <!-- ── Barre de progression ── -->
    <div class="shrink-0 px-6 pb-6 pt-2">
      {#if session}
        <div
          class="w-full h-2 rounded-full overflow-hidden"
          style="background: rgba(0,0,0,0.3);"
        >
          <div
            class="h-full rounded-full"
            style="width: {progressFrac * 100}%;
                   background: {phaseCfg.accent};
                   transition: width 150ms linear;"
          ></div>
        </div>
      {:else if session}
        <!-- Barre de progression de la phase globale même en mode attente -->
        <div class="h-1 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.05);">
          <div
            class="h-full rounded-full"
            style="width: {progressFrac * 100}%; background: rgba(255,255,255,0.1);
                   transition: width 150ms linear;"
          ></div>
        </div>
      {/if}
    </div>

  </div>
{/if}

<style>
  @keyframes cfpulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  @keyframes bottle-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-10px); }
  }
  .water-bottle-anim {
    animation: bottle-float 2s ease-in-out infinite;
  }
</style>
