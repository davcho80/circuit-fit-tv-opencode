<script lang="ts">
  import { goto } from '$app/navigation';
  import { circuits as api } from '$lib/api';
  import type { CircuitCreate } from '$lib/api';
  import type { PageProps } from './$types';
  import CircuitBuilder from '$lib/CircuitBuilder.svelte';

  let { data }: PageProps = $props();

  async function handleCreate(payload: CircuitCreate) {
    const created = await api.create(payload);
    await goto(`/circuits/${created.id}`);
  }
</script>

<svelte:head>
  <title>Nouveau circuit — Circuit Fit TV</title>
</svelte:head>

<div class="p-6">
  <div class="mb-6">
    <a href="/circuits" class="text-slate-400 hover:text-slate-200 text-sm transition-colors">
      ← Circuits
    </a>
    <h1 class="text-2xl font-bold text-slate-100 mt-2">Nouveau circuit</h1>
  </div>

  <CircuitBuilder
    exercises={data.exercises}
    onsubmit={handleCreate}
    submitLabel="Créer le circuit"
  />
</div>
