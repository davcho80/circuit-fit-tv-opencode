<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createWsConnection } from '$lib/ws.svelte.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // ---- Connexion WS coach ----
  const conn = createWsConnection('coach', 'Coach');
  onDestroy(() => conn.destroy());

  // ---- État local ----
  let selectedCircuitId = $state('');

  // ---- Timer (tick 100 ms) ----
  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => { now = Date.now(); }, 100);
    return () => clearInterval(id);
  });

  // ---- Dérivés ----
  const session = $derived(conn.session);

  const remainingMs = $derived.by(() => {
    if (!session) return 0;
    if (session.status === 'PAUSED') return session.remainingOnPauseMs ?? 0;
    return Math.max(0, session.phaseEndsAt - (now + conn.clockOffset));
  });

  const remainingSec = $derived(Math.ceil(remainingMs / 1000));

  const progressFrac = $derived.by(() => {
    if (!session || session.phase.durationMs === 0) return 0;
    const elapsed = session.phase.durationMs - remainingMs;
    return Math.min(1, Math.max(0, elapsed / session.phase.durationMs));
  });

  const selectedCircuit = $derived(
    data.circuits.find(c => c.id === (session?.circuitId ?? selectedCircuitId))
  );

  // ---- Phase config ----
  const PHASE: Record<string, { bg: string; border: string; name: string }> = {
    WORK:       { bg: 'bg-emerald-500/10', border: 'border-emerald-500', name: 'TRAVAIL'    },
    REST:       { bg: 'bg-sky-500/10',     border: 'border-sky-500',     name: 'REPOS'      },
    TRANSITION: { bg: 'bg-amber-500/10',   border: 'border-amber-500',   name: 'TRANSITION' },
  };

  const phaseCfg = $derived(session ? (PHASE[session.phase.type] ?? PHASE['WORK']) : null);

  // ---- Couleur texte de la phase ----
  const PHASE_TEXT: Record<string, string> = {
    WORK: 'text-emerald-400', REST: 'text-sky-400', TRANSITION: 'text-amber-400',
  };

  // ---- Commandes ----
  function startSession() {
    if (!selectedCircuitId) return;
    conn.send({ type: 'START', circuitId: selectedCircuitId });
  }
  function pause()  { conn.send({ type: 'PAUSE' }); }
  function resume() { conn.send({ type: 'RESUME' }); }
  function skip()   { conn.send({ type: 'SKIP' }); }
  function stop()   {
    if (!confirm('Arrêter la session en cours ?')) return;
    conn.send({ type: 'STOP' });
  }
  function adjust(deltaMs: number) { conn.send({ type: 'ADJUST', deltaMs }); }
  function hydrationBreak(durationMs: number) { conn.send({ type: 'HYDRATION_BREAK', durationMs }); }

  // ---- Pause eau : temps restant ----
  const hydrationRemainingMs = $derived.by(() => {
    const endsAt = session?.hydrationBreakEndsAt;
    if (!endsAt) return 0;
    return Math.max(0, endsAt - (now + conn.clockOffset));
  });
  const hydrationRemainingSec = $derived(Math.ceil(hydrationRemainingMs / 1000));

  // ---- Rôle icons ----
  const ROLE_ICON: Record<string, string> = {
    tv: '📺', coach: '🎯', monitor: '👁',
  };
</script>

<svelte:head>
  <title>Session live — Circuit Fit TV</title>
</svelte:head>

<div class="p-6 max-w-5xl mx-auto space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-slate-100">Session live</h1>
    <span class="flex items-center gap-2 text-sm">
      <span
        class="inline-block w-2 h-2 rounded-full {conn.connected ? 'bg-green-400' : 'bg-red-400'}"
      ></span>
      <span class="text-slate-400">{conn.connected ? 'Connecté' : 'Reconnexion…'}</span>
    </span>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

    <!-- ══════════ Panneau principal ══════════ -->
    <div class="lg:col-span-2 space-y-4">

      {#if !session}
        <!-- Pas de session — Sélecteur de circuit -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 class="text-lg font-semibold text-slate-200">Démarrer une session</h2>

          {#if data.circuits.length === 0}
            <p class="text-slate-400 text-sm">
              Aucun circuit disponible.
              <a href="/circuits/new" class="text-sky-400 hover:underline">Créer un circuit</a>
            </p>
          {:else}
            <div>
              <label for="circuit-select" class="block text-sm font-medium text-slate-400 mb-1">
                Circuit
              </label>
              <select
                id="circuit-select"
                bind:value={selectedCircuitId}
                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5
                       text-slate-100 focus:outline-none focus:border-sky-500"
              >
                <option value="">— Choisir un circuit —</option>
                {#each data.circuits as c}
                  <option value={c.id}>
                    {c.name} ({c.stations.length} stations · {c.rounds} rounds · {c.workSec}s/{c.restSec}s)
                  </option>
                {/each}
              </select>
            </div>

            {#if selectedCircuit}
              <div class="space-y-3">
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                  <span>{selectedCircuit.rounds} rounds</span>
                  <span>Travail {selectedCircuit.workSec}s</span>
                  <span>Repos {selectedCircuit.restSec}s</span>
                  <span>Transition {selectedCircuit.transitionSec}s</span>
                </div>

                <div class="border border-slate-800 rounded-lg divide-y divide-slate-800">
                  {#each selectedCircuit.stations.sort((a, b) => a.position - b.position) as station, i}
                    <div class="flex items-center gap-3 px-4 py-2.5">
                      <span class="w-7 h-7 bg-slate-800 rounded-md flex items-center justify-center
                                   text-xs font-bold text-sky-400 shrink-0">
                        {i + 1}
                      </span>
                      <div class="min-w-0 flex-1">
                        {#if station.exercises.length > 0}
                          <p class="text-sm text-slate-200 truncate">
                            {station.exercises.map(e => e.exercise.name).join(', ')}
                          </p>
                        {:else}
                          <p class="text-sm text-slate-500 italic">Aucun exercice</p>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <button
              onclick={startSession}
              disabled={!selectedCircuitId || !conn.connected}
              class="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500
                     disabled:opacity-40 disabled:cursor-not-allowed
                     text-white font-bold rounded-xl transition-colors"
            >
              Démarrer la session
            </button>
          {/if}
        </div>

        {#if conn.sessionEndedReason}
          <div class="bg-slate-900 border border-slate-700 rounded-xl p-6 text-center space-y-2">
            <p class="text-3xl">
              {conn.sessionEndedReason === 'completed' ? '🎉' : '⏹'}
            </p>
            <p class="text-lg font-semibold text-slate-200">
              {conn.sessionEndedReason === 'completed' ? 'Session terminée !' : 'Session arrêtée'}
            </p>
            <p class="text-sm text-slate-400">
              {conn.sessionEndedReason === 'completed'
                ? 'Bravo ! Tous les rounds ont été complétés.'
                : 'La session a été interrompue manuellement.'}
            </p>
          </div>
        {/if}

      {:else}
        <!-- Session active -->
        <div class="bg-slate-900 border {phaseCfg?.border ?? 'border-slate-800'} rounded-xl overflow-hidden">

          <!-- En-tête session -->
          <div class="px-6 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h2 class="text-lg font-bold text-slate-100">
                {selectedCircuit?.name ?? 'Session active'}
              </h2>
              <div class="flex items-center gap-3 text-sm text-slate-400 mt-1">
                <span>Round {session.round}/{session.totalRounds}</span>
                <span class="opacity-40">·</span>
                <span>Phase {session.currentPhaseIdx + 1}/{session.totalPhases}</span>
                <span class="opacity-40">·</span>
                <span class="{session.status === 'PAUSED' ? 'text-amber-400' : 'text-emerald-400'}">
                  {session.status === 'PAUSED' ? '⏸ En pause' : '● En cours'}
                </span>
              </div>
            </div>
          </div>

          <!-- Phase actuelle -->
          <div class="px-6 py-6 {phaseCfg?.bg ?? ''}">
            <div class="flex items-end justify-between">
              <div>
                <p class="text-xs font-bold tracking-widest uppercase {PHASE_TEXT[session.phase.type] ?? 'text-slate-300'} mb-1">
                  {phaseCfg?.name ?? session.phase.type}
                </p>
                <p class="text-3xl font-bold text-slate-100">
                  {session.phase.label}
                </p>
              </div>
              <div class="text-right">
                <p class="text-5xl font-black tabular-nums text-slate-100 leading-none">
                  {remainingSec}
                </p>
                <p class="text-xs text-slate-400 mt-1 tracking-wider uppercase">secondes</p>
              </div>
            </div>

            <!-- Barre de progression -->
            <div class="mt-4 w-full h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
              <div
                class="h-full rounded-full transition-[width] duration-150"
                style="width: {progressFrac * 100}%;
                       background: {session.phase.type === 'WORK' ? '#059669' : session.phase.type === 'REST' ? '#0ea5e9' : '#f59e0b'};"
              ></div>
            </div>
          </div>

          <!-- Contrôles -->
          <div class="px-6 py-4 border-t border-slate-800 flex flex-wrap items-center gap-3">
            {#if session.status === 'RUNNING'}
              <button onclick={pause}
                class="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold
                       rounded-lg transition-colors">
                ⏸ Pause
              </button>
            {:else}
              <button onclick={resume}
                class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold
                       rounded-lg transition-colors">
                ▶ Reprendre
              </button>
            {/if}

            <button onclick={skip}
              class="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold
                     rounded-lg transition-colors">
              ⏭ Skip
            </button>

            <div class="flex items-center gap-1">
              <button onclick={() => adjust(-10_000)}
                class="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm
                       rounded-lg transition-colors font-mono">
                -10s
              </button>
              <button onclick={() => adjust(10_000)}
                class="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm
                       rounded-lg transition-colors font-mono">
                +10s
              </button>
            </div>

            <div class="flex-1"></div>

            <button onclick={stop}
              class="px-5 py-2.5 border border-red-800 hover:bg-red-900/50 text-red-400
                     font-semibold rounded-lg transition-colors">
              ⏹ Arrêter
            </button>
          </div>

          <!-- Pause eau -->
          <div class="px-6 py-4 border-t border-slate-800 space-y-2">
            {#if hydrationRemainingSec > 0}
              <!-- Break eau actif -->
              <div class="flex items-center gap-3 px-4 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                <span class="text-2xl">💧</span>
                <div class="flex-1">
                  <p class="text-sm font-bold text-cyan-300 tracking-widest uppercase">Pause eau</p>
                  <p class="text-xs text-cyan-400/70">Reprise automatique dans {hydrationRemainingSec}s</p>
                </div>
                <button
                  onclick={resume}
                  class="px-3 py-1.5 text-xs font-semibold bg-cyan-700/50 hover:bg-cyan-600/50
                         text-cyan-200 rounded-lg transition-colors"
                >
                  Reprendre maintenant
                </button>
              </div>
            {:else}
              <div class="flex items-center gap-2">
                <span class="text-slate-500 text-sm font-medium">💧 Pause eau</span>
                <div class="flex items-center gap-1">
                  {#each [[30_000,'30s'],[60_000,'1 min'],[120_000,'2 min']] as [ms, label]}
                    <button
                      onclick={() => hydrationBreak(ms as number)}
                      class="px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-cyan-700/60
                             text-slate-300 hover:text-cyan-200 rounded-lg transition-colors"
                    >
                      {label}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- ══════════ Panneau latéral ══════════ -->
    <div class="space-y-4">

      {#if session && selectedCircuit}
        <!-- Stations du circuit -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 class="text-sm font-semibold text-slate-300 mb-3">Stations</h3>
          <ul class="space-y-1.5">
            {#each selectedCircuit.stations.sort((a, b) => a.position - b.position) as station, i}
              {@const isActive = session.phase.type === 'WORK' && session.stationIdx === i}
              <li class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                         {isActive ? 'bg-emerald-500/10 border border-emerald-500/30' : ''}">
                <span class="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0
                             {isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}">
                  {i + 1}
                </span>
                <span class="truncate {isActive ? 'text-emerald-200 font-medium' : 'text-slate-400'}">
                  {station.exercises.length > 0
                    ? station.exercises.map(e => e.exercise.name).join(', ')
                    : 'Station vide'}
                </span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 class="text-sm font-semibold text-slate-300 mb-3">
          Clients connectés
          <span class="text-slate-500 font-normal">({conn.clientList.length})</span>
        </h3>

        {#if conn.clientList.length === 0}
          <p class="text-slate-500 text-sm">Aucun client connecté.</p>
        {:else}
          <ul class="space-y-2">
            {#each conn.clientList as client}
              <li class="flex items-center gap-2 text-sm">
                <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                <span class="text-slate-200 truncate">{ROLE_ICON[client.role] ?? '?'} {client.label}</span>
                <span class="text-slate-500 text-xs ml-auto">{client.role}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>

  </div>
</div>
