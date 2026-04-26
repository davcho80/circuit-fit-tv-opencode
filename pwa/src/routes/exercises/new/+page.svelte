<script lang="ts">
  import { goto } from '$app/navigation';
  import { exercises as api } from '$lib/api';
  import type { ExerciseCreate } from '$lib/api';
  import ExerciseForm from '$lib/ExerciseForm.svelte';

  async function handleCreate(data: ExerciseCreate) {
    const created = await api.create(data);
    await goto(`/exercises/${created.id}`);
  }
</script>

<svelte:head>
  <title>Nouvel exercice — Circuit Fit TV</title>
</svelte:head>

<div class="p-6 max-w-xl">
  <div class="mb-6">
    <a href="/exercises" class="text-slate-400 hover:text-slate-200 text-sm transition-colors">
      ← Exercices
    </a>
    <h1 class="text-2xl font-bold text-slate-100 mt-2">Nouvel exercice</h1>
  </div>

  <ExerciseForm onsubmit={handleCreate} submitLabel="Créer l'exercice" />
</div>
