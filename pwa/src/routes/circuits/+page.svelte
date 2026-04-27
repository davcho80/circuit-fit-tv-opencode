<script lang="ts">
  import type { PageProps } from './$types';
  import { invalidateAll } from '$app/navigation';
  import { circuits as api } from '$lib/api';

  let { data }: PageProps = $props();

  let deleting = $state<string | null>(null);

  async function deleteCircuit(id: string, name: string) {
    if (!confirm(`Supprimer le circuit « ${name} » ?`)) return;
    deleting = id;
    try {
      await api.delete(id);
      await invalidateAll();
    } finally {
      deleting = null;
    }
  }

  function totalDuration(c: typeof data.circuits[0]): string {
    const stationCount = c.stations.length;
    const perRound = (c.workSec + c.restSec) * stationCount + c.transitionSec * (stationCount - 1);
    const total = perRound * c.rounds;
    const min = Math.floor(total / 60);
    return `~${min} min`;
  }
</script>

<svelte:head>
  <title>Circuits — Circuit Fit TV</title>
</svelte:head>

<div class="p-6">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-100">Circuits</h1>
      <p class="text-slate-400 text-sm mt-0.5">
        {data.circuits.length} circuit{data.circuits.length > 1 ? 's' : ''}
      </p>
    </div>
    <a
      href="/circuits/new"
      class="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white
             font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
    >
      <span>+</span> Nouveau circuit
    </a>
  </div>

  {#if data.circuits.length === 0}
    <div class="text-center py-20 text-slate-500">
      <p class="text-4xl mb-3">🔄</p>
      <p class="text-lg font-medium">Aucun circuit</p>
      <p class="text-sm mt-1">Créez votre premier circuit d'entraînement.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {#each data.circuits as c (c.id)}
        <div class="relative bg-slate-900 border border-slate-800 hover:border-slate-600
                    rounded-xl p-5 transition-colors group">
          <!-- Lien étendu sur toute la carte -->
          <a href="/circuits/{c.id}" class="absolute inset-0 rounded-xl" aria-label={c.name}></a>

          <!-- En-tête -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 min-w-0">
              <span class="font-semibold text-slate-100 group-hover:text-sky-300 transition-colors
                           block truncate">
                {c.name}
              </span>
              {#if c.description}
                <p class="text-xs text-slate-500 mt-0.5 line-clamp-1">{c.description}</p>
              {/if}
            </div>
            <button
              onclick={() => deleteCircuit(c.id, c.name)}
              disabled={deleting === c.id}
              class="relative z-10 text-slate-600 hover:text-red-400 transition-colors ml-2 shrink-0"
              title="Supprimer"
            >
              {deleting === c.id ? '…' : '🗑️'}
            </button>
          </div>

          <!-- Stations preview -->
          <div class="flex gap-1.5 flex-wrap mb-3">
            {#each c.stations as s}
              {@const exName = s.exercises[0]?.exercise.name ?? '—'}
              <span class="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full
                           truncate max-w-[120px]" title={exName}>
                {s.position}. {exName}
              </span>
            {/each}
          </div>

          <!-- Stats -->
          <div class="flex items-center gap-3 text-xs text-slate-500">
            <span>🔁 {c.rounds} round{c.rounds > 1 ? 's' : ''}</span>
            <span>💪 {c.workSec}s</span>
            <span>😮‍💨 {c.restSec}s</span>
            <span class="ml-auto font-medium text-slate-400">{totalDuration(c)}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
