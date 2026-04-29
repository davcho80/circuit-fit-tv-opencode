<script lang="ts">
  import { goto } from '$app/navigation';
  import { circuits as api, type Circuit } from '$lib/api';
  import type { CircuitCreate } from '$lib/api';
  import type { PageProps } from './$types';
  import CircuitBuilder from '$lib/CircuitBuilder.svelte';
  import LayoutEditor from '$lib/LayoutEditor.svelte';

  let { data }: PageProps = $props();

  type Tab = 'circuit' | 'layout';
  let activeTab = $state<Tab>('circuit');

  // Synced circuit data (refreshed after layout save)
  let circuit = $state(data.circuit);

  async function handleUpdate(payload: CircuitCreate) {
    // 1. Mettre à jour les champs scalaires
    await api.update(circuit.id, {
      name:          payload.name,
      description:   payload.description,
      icon:          payload.icon,
      rounds:        payload.rounds,
      workSec:       payload.workSec,
      restSec:       payload.restSec,
      transitionSec: payload.transitionSec,
      rotationMode:  payload.rotationMode,
    });

    // 2. Remplacer les stations
    await api.updateStations(circuit.id, payload.stations);

    // 3. Remplacer les pauses programmées
    await api.updateBreaks(circuit.id, payload.scheduledBreaks ?? []);

    // 4. Recharger les données
    circuit = await api.get(circuit.id);
  }

  async function handleDelete() {
    if (!confirm(`Supprimer « ${circuit.name} » ?`)) return;
    await api.delete(circuit.id);
    await goto('/circuits');
  }

  async function handleLayoutSave(
    positions: Array<{ id: string; layoutX: number; layoutY: number }>,
    links: Array<{ from: string; to: string }>,
  ) {
    circuit = await api.updateLayout(circuit.id, positions, links);
  }
</script>

<svelte:head>
  <title>{circuit.name} — Circuit Fit TV</title>
</svelte:head>

<div class="p-6">
  <!-- En-tête -->
  <div class="mb-6">
    <a href="/circuits" class="text-slate-400 hover:text-slate-200 text-sm transition-colors">
      ← Circuits
    </a>
    <div class="flex items-center justify-between mt-2">
      <h1 class="text-2xl font-bold text-slate-100">{circuit.name}</h1>
      <button
        onclick={handleDelete}
        class="text-slate-500 hover:text-red-400 transition-colors text-sm px-3 py-1.5
               border border-slate-700 hover:border-red-800 rounded-lg"
      >
        Supprimer
      </button>
    </div>
  </div>

  <!-- Onglets -->
  <div class="flex gap-1 mb-6 border-b border-slate-800">
    {#each [
      { id: 'circuit', label: '⚙️ Circuit' },
      { id: 'layout',  label: '🗺️ Plan de salle' },
    ] as tab}
      <button
        onclick={() => { activeTab = tab.id as Tab; }}
        class="px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors
               {activeTab === tab.id
                 ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                 : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}"
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#if activeTab === 'circuit'}
    <CircuitBuilder
      initial={circuit}
      exercises={data.exercises}
      onsubmit={handleUpdate}
      submitLabel="Sauvegarder les modifications"
    />
  {:else}
    {#if circuit.stations.length < 2}
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        Ajoutez au moins 2 stations dans l'onglet Circuit avant de configurer le plan.
      </div>
    {:else}
      <LayoutEditor
        stations={circuit.stations}
        savedLinks={circuit.layoutLinks}
        onSave={handleLayoutSave}
      />
    {/if}
  {/if}
</div>
