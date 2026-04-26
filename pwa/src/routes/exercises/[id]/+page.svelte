<script lang="ts">
  import type { PageProps } from './$types';
  import { goto, invalidateAll } from '$app/navigation';
  import { exercises as api } from '$lib/api';
  import type { ExerciseCreate } from '$lib/api';
  import ExerciseForm from '$lib/ExerciseForm.svelte';

  let { data }: PageProps = $props();
  let ex = $derived(data.exercise);

  // ---- Upload vidéo ----
  let uploadProgress = $state<number | null>(null);
  let uploadError = $state('');
  let fileInput = $state<HTMLInputElement | null>(null);

  async function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploadError = '';
    uploadProgress = 0;

    try {
      await api.uploadVideo(ex.id, file, (pct) => { uploadProgress = pct; });
      await invalidateAll();
    } catch (err) {
      uploadError = err instanceof Error ? err.message : String(err);
    } finally {
      uploadProgress = null;
      if (fileInput) fileInput.value = '';
    }
  }

  // ---- Modifier ----
  async function handleUpdate(formData: ExerciseCreate) {
    await api.update(ex.id, formData);
    await invalidateAll();
  }

  // ---- Supprimer ----
  async function handleDelete() {
    if (!confirm(`Supprimer « ${ex.name} » ? Cette action est irréversible.`)) return;
    await api.delete(ex.id);
    await goto('/exercises');
  }

  const difficultyLabel: Record<string, string> = {
    BEGINNER: 'Débutant',
    INTERMEDIATE: 'Intermédiaire',
    ADVANCED: 'Avancé',
  };
</script>

<svelte:head>
  <title>{ex.name} — Circuit Fit TV</title>
</svelte:head>

<div class="p-6">
  <div class="mb-6">
    <a href="/exercises" class="text-slate-400 hover:text-slate-200 text-sm transition-colors">
      ← Exercices
    </a>
    <div class="flex items-start justify-between mt-2">
      <h1 class="text-2xl font-bold text-slate-100">{ex.name}</h1>
      <button
        onclick={handleDelete}
        class="text-slate-500 hover:text-red-400 transition-colors text-sm px-3 py-1.5
               border border-slate-700 hover:border-red-800 rounded-lg"
      >
        Supprimer
      </button>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <!-- Colonne gauche : vidéo + upload -->
    <div class="space-y-4">
      <!-- Player / thumbnail -->
      <div class="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 aspect-video
                  flex items-center justify-center">
        {#if ex.videoUrl}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            src={ex.videoUrl}
            poster={ex.thumbnailUrl || undefined}
            controls
            class="w-full h-full object-contain"
          ></video>
        {:else if ex.thumbnailUrl}
          <img src={ex.thumbnailUrl} alt={ex.name} class="w-full h-full object-cover" />
        {:else}
          <div class="text-slate-600 text-center">
            <p class="text-4xl mb-2">🎬</p>
            <p class="text-sm">Aucune vidéo</p>
          </div>
        {/if}
      </div>

      <!-- Méta vidéo -->
      {#if ex.durationSec > 0}
        <p class="text-slate-400 text-sm">
          Durée : {Math.floor(ex.durationSec / 60)}:{String(ex.durationSec % 60).padStart(2, '0')}
        </p>
      {/if}

      <!-- Upload vidéo -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p class="text-sm font-medium text-slate-300 mb-3">
          {ex.videoUrl ? 'Remplacer la vidéo' : 'Uploader une vidéo'}
        </p>

        {#if uploadProgress !== null}
          <!-- Barre de progression -->
          <div class="space-y-2">
            <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-sky-500 transition-all duration-300 rounded-full"
                style="width: {uploadProgress}%"
              ></div>
            </div>
            <p class="text-xs text-slate-400 text-center">
              {uploadProgress < 100 ? `Upload : ${uploadProgress}%` : 'Transcodage en cours…'}
            </p>
          </div>
        {:else}
          <label class="flex items-center justify-center gap-2 border-2 border-dashed
                        border-slate-700 hover:border-sky-600 rounded-lg p-6 cursor-pointer
                        transition-colors group">
            <span class="text-2xl">📁</span>
            <span class="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
              Choisir un fichier vidéo
            </span>
            <input
              bind:this={fileInput}
              type="file"
              accept="video/*"
              onchange={handleFileChange}
              class="sr-only"
            />
          </label>
        {/if}

        {#if uploadError}
          <p class="text-sm text-red-400 mt-2">{uploadError}</p>
        {/if}
      </div>
    </div>

    <!-- Colonne droite : formulaire d'édition -->
    <div>
      <h2 class="text-lg font-semibold text-slate-200 mb-4">Informations</h2>

      <!-- Badges musclés / équip -->
      {#if ex.muscleGroups.length > 0 || ex.equipment.length > 0}
        <div class="flex flex-wrap gap-1.5 mb-4">
          {#each ex.muscleGroups as m}
            <span class="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">{m}</span>
          {/each}
          {#each ex.equipment as e}
            <span class="text-xs bg-slate-800 text-sky-300 px-2 py-0.5 rounded-full">{e}</span>
          {/each}
        </div>
      {/if}

      <ExerciseForm
        initial={ex}
        onsubmit={handleUpdate}
        submitLabel="Sauvegarder les modifications"
      />
    </div>
  </div>
</div>
