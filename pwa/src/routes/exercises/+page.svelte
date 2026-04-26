<script lang="ts">
  import type { PageProps } from './$types';
  import { invalidateAll } from '$app/navigation';
  import { exercises as api } from '$lib/api';

  let { data }: PageProps = $props();

  const difficultyLabel: Record<string, string> = {
    BEGINNER: 'Débutant',
    INTERMEDIATE: 'Intermédiaire',
    ADVANCED: 'Avancé',
  };

  const difficultyColor: Record<string, string> = {
    BEGINNER: 'bg-emerald-900/50 text-emerald-300',
    INTERMEDIATE: 'bg-amber-900/50 text-amber-300',
    ADVANCED: 'bg-red-900/50 text-red-300',
  };

  let deleting = $state<string | null>(null);

  async function deleteExercise(id: string, name: string) {
    if (!confirm(`Supprimer « ${name} » ?`)) return;
    deleting = id;
    try {
      await api.delete(id);
      await invalidateAll();
    } finally {
      deleting = null;
    }
  }
</script>

<svelte:head>
  <title>Exercices — Circuit Fit TV</title>
</svelte:head>

<div class="p-6">
  <!-- En-tête -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-100">Exercices</h1>
      <p class="text-slate-400 text-sm mt-0.5">{data.total} exercice{data.total > 1 ? 's' : ''}</p>
    </div>
    <a
      href="/exercises/new"
      class="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold
             px-4 py-2 rounded-lg transition-colors text-sm"
    >
      <span class="text-base">+</span>
      Nouvel exercice
    </a>
  </div>

  <!-- Grille -->
  {#if data.exercises.length === 0}
    <div class="text-center py-20 text-slate-500">
      <p class="text-4xl mb-3">🏋️</p>
      <p class="text-lg font-medium">Aucun exercice</p>
      <p class="text-sm mt-1">Créez votre premier exercice pour commencer.</p>
    </div>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {#each data.exercises as ex (ex.id)}
        <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden
                    hover:border-slate-600 transition-colors group">
          <!-- Thumbnail -->
          <a href="/exercises/{ex.id}" class="block relative aspect-video bg-slate-800">
            {#if ex.thumbnailUrl}
              <img
                src={ex.thumbnailUrl}
                alt={ex.name}
                class="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                loading="lazy"
              />
            {:else}
              <div class="w-full h-full flex items-center justify-center text-slate-600">
                <span class="text-3xl">🎬</span>
              </div>
            {/if}
            <!-- Badge durée -->
            {#if ex.durationSec > 0}
              <span class="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                {Math.floor(ex.durationSec / 60)}:{String(ex.durationSec % 60).padStart(2, '0')}
              </span>
            {/if}
          </a>

          <!-- Infos -->
          <div class="p-3">
            <a href="/exercises/{ex.id}" class="block font-medium text-slate-100 text-sm
                                                hover:text-sky-300 transition-colors leading-tight mb-2 line-clamp-2">
              {ex.name}
            </a>

            <div class="flex items-center justify-between">
              <span class="text-xs px-2 py-0.5 rounded-full font-medium
                           {difficultyColor[ex.difficulty] ?? 'bg-slate-700 text-slate-300'}">
                {difficultyLabel[ex.difficulty] ?? ex.difficulty}
              </span>

              <button
                onclick={() => deleteExercise(ex.id, ex.name)}
                disabled={deleting === ex.id}
                class="text-slate-600 hover:text-red-400 transition-colors text-sm p-1 -mr-1"
                title="Supprimer"
              >
                {deleting === ex.id ? '…' : '🗑️'}
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
