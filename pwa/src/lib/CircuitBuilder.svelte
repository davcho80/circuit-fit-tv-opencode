<!--
  CircuitBuilder — formulaire complet pour créer ou modifier un circuit.

  Props :
    initial  : données existantes (mode édition) ou undefined (mode création)
    exercises: liste complète des exercices disponibles
    onsubmit : appelé avec le payload CircuitCreate validé
-->
<script lang="ts">
  import type { Circuit, CircuitCreate, Exercise } from './api';

  interface Props {
    initial?: Circuit;
    exercises: Exercise[];
    onsubmit: (data: CircuitCreate) => Promise<void>;
    submitLabel?: string;
  }

  let { initial, exercises, onsubmit, submitLabel = 'Enregistrer' }: Props = $props();

  // ---- État du formulaire ----
  let name = $state(initial?.name ?? '');
  let description = $state(initial?.description ?? '');
  let rounds = $state(initial?.rounds ?? 3);
  let workSec = $state(initial?.workSec ?? 40);
  let restSec = $state(initial?.restSec ?? 20);
  let transitionSec = $state(initial?.transitionSec ?? 10);
  let rotationMode = $state<'CLASSIC' | 'FIXED'>(initial?.rotationMode ?? 'CLASSIC');

  // Stations locales : un tableau de listes d'exerciceIds
  interface LocalStation { exerciseIds: string[] }
  let stations = $state<LocalStation[]>(
    initial?.stations.map((s) => ({
      exerciseIds: s.exercises.map((e) => e.exercise.id),
    })) ?? [{ exerciseIds: [] }, { exerciseIds: [] }],
  );

  // Pauses programmées
  interface LocalBreak { afterRound: number; durationSec: number }
  let scheduledBreaks = $state<LocalBreak[]>(
    initial?.scheduledBreaks?.map((b) => ({ afterRound: b.afterRound, durationSec: b.durationSec })) ?? [],
  );

  function addBreak() {
    // Propose le premier round sans pause encore défini
    const usedRounds = new Set(scheduledBreaks.map((b) => b.afterRound));
    const next = Array.from({ length: rounds - 1 }, (_, i) => i + 1).find((r) => !usedRounds.has(r));
    if (next === undefined) return; // tous les rounds ont déjà une pause
    scheduledBreaks = [...scheduledBreaks, { afterRound: next, durationSec: 60 }];
  }

  function removeBreak(idx: number) {
    scheduledBreaks = scheduledBreaks.filter((_, i) => i !== idx);
  }

  // ---- Picker d'exercices ----
  let pickerOpenIdx = $state<number | null>(null); // index de la station en cours d'édition
  let pickerSearch = $state('');

  let filteredExercises = $derived(
    pickerSearch.trim()
      ? exercises.filter((e) =>
          e.name.toLowerCase().includes(pickerSearch.toLowerCase()),
        )
      : exercises,
  );

  function openPicker(idx: number) {
    pickerOpenIdx = idx;
    pickerSearch = '';
  }

  function closePicker() {
    pickerOpenIdx = null;
  }

  function toggleExercise(stationIdx: number, exerciseId: string) {
    const ids = stations[stationIdx]!.exerciseIds;
    if (ids.includes(exerciseId)) {
      stations[stationIdx]!.exerciseIds = ids.filter((id) => id !== exerciseId);
    } else {
      stations[stationIdx]!.exerciseIds = [...ids, exerciseId];
    }
  }

  // ---- Gestion des stations ----
  function addStation() {
    if (stations.length >= 20) return;
    stations = [...stations, { exerciseIds: [] }];
  }

  function removeStation(idx: number) {
    if (stations.length <= 2) return;
    stations = stations.filter((_, i) => i !== idx);
    if (pickerOpenIdx === idx) pickerOpenIdx = null;
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const copy = [...stations];
    [copy[idx - 1], copy[idx]] = [copy[idx]!, copy[idx - 1]!];
    stations = copy;
  }

  function moveDown(idx: number) {
    if (idx === stations.length - 1) return;
    const copy = [...stations];
    [copy[idx], copy[idx + 1]] = [copy[idx + 1]!, copy[idx]!];
    stations = copy;
  }

  // ---- Helpers d'affichage ----
  function exerciseById(id: string): Exercise | undefined {
    return exercises.find((e) => e.id === id);
  }

  function stationLabel(s: LocalStation): string {
    if (s.exerciseIds.length === 0) return 'Aucun exercice';
    return s.exerciseIds
      .map((id) => exerciseById(id)?.name ?? '?')
      .join(' / ');
  }

  // ---- Durée estimée ----
  let estimatedMin = $derived(() => {
    const n = stations.length;
    const perRound = (workSec + restSec) * n + transitionSec * Math.max(0, n - 1);
    return Math.round((perRound * rounds) / 60);
  });

  // ---- Validation & submit ----
  let saving = $state(false);
  let error = $state('');

  let isValid = $derived(
    name.trim().length > 0 &&
    stations.length >= 2 &&
    stations.every((s) => s.exerciseIds.length > 0),
  );

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!isValid) return;
    error = '';
    saving = true;
    try {
      await onsubmit({
        name: name.trim(),
        description: description.trim() || null,
        rounds,
        workSec,
        restSec,
        transitionSec,
        rotationMode,
        stations: stations.map((s, i) => ({
          position: i + 1,
          exerciseIds: s.exerciseIds,
        })),
        scheduledBreaks: scheduledBreaks.map((b) => ({ afterRound: b.afterRound, durationSec: b.durationSec, label: 'Pause eau' })),
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }
</script>

<form onsubmit={handleSubmit} class="space-y-0">
  <div class="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">

    <!-- ======== COLONNE GAUCHE : paramètres ======== -->
    <div class="space-y-5">
      <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Paramètres</h2>

      <!-- Nom -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1" for="c-name">Nom *</label>
        <input
          id="c-name"
          type="text"
          bind:value={name}
          required maxlength="100"
          placeholder="Ex : HIIT 8 stations"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100
                 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 text-sm"
        />
      </div>

      <!-- Description -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1" for="c-desc">Description</label>
        <textarea
          id="c-desc"
          bind:value={description}
          maxlength="500" rows="2"
          placeholder="Notes pour le coach…"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100
                 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 text-sm resize-none"
        ></textarea>
      </div>

      <!-- Rounds -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-2" for="c-rounds">
          Rounds — <span class="text-sky-400 font-semibold">{rounds}</span>
        </label>
        <input id="c-rounds" type="range" min="1" max="10" bind:value={rounds}
               class="w-full accent-sky-500" />
        <div class="flex justify-between text-xs text-slate-500 mt-1">
          <span>1</span><span>10</span>
        </div>
      </div>

      <!-- Timings -->
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1" for="c-work">Travail (s)</label>
          <input id="c-work" type="number" min={5} max={600} bind:value={workSec}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                   text-slate-100 text-sm text-center focus:outline-none focus:border-sky-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1" for="c-rest">Repos (s)</label>
          <input id="c-rest" type="number" min={0} max={300} bind:value={restSec}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                   text-slate-100 text-sm text-center focus:outline-none focus:border-sky-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1" for="c-trans">Transition (s)</label>
          <input id="c-trans" type="number" min={0} max={60} bind:value={transitionSec}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                   text-slate-100 text-sm text-center focus:outline-none focus:border-sky-500" />
        </div>
      </div>

      <!-- Pauses eau programmées -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-slate-300">💧 Pauses eau</span>
          <button
            type="button"
            onclick={addBreak}
            disabled={scheduledBreaks.length >= rounds - 1}
            class="text-xs bg-slate-800 hover:bg-cyan-700/50 disabled:opacity-30
                   text-slate-300 hover:text-cyan-200 px-2.5 py-1 rounded-lg transition-colors
                   border border-slate-700"
          >
            + Ajouter
          </button>
        </div>

        {#if scheduledBreaks.length === 0}
          <p class="text-xs text-slate-500 italic">
            Aucune pause programmée. Les participants boivent entre les rounds si besoin.
          </p>
        {:else}
          <div class="space-y-1.5">
            {#each scheduledBreaks as brk, idx}
              <div class="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50">
                <span class="text-cyan-400 text-sm shrink-0">💧</span>
                <span class="text-xs text-slate-400 shrink-0">Après round</span>
                <select
                  bind:value={brk.afterRound}
                  class="bg-slate-700 border border-slate-600 rounded px-2 py-1
                         text-slate-100 text-xs focus:outline-none focus:border-cyan-500 w-14"
                >
                  {#each Array.from({ length: rounds - 1 }, (_, i) => i + 1) as r}
                    <option value={r}>{r}</option>
                  {/each}
                </select>
                <span class="text-xs text-slate-400 shrink-0">→</span>
                <select
                  bind:value={brk.durationSec}
                  class="bg-slate-700 border border-slate-600 rounded px-2 py-1
                         text-slate-100 text-xs focus:outline-none focus:border-cyan-500 flex-1"
                >
                  {#each [[30,'30 s'],[60,'1 min'],[90,'1 min 30'],[120,'2 min'],[180,'3 min']] as [s, lbl]}
                    <option value={s}>{lbl}</option>
                  {/each}
                </select>
                <button
                  type="button"
                  onclick={() => removeBreak(idx)}
                  class="text-slate-600 hover:text-red-400 transition-colors text-sm shrink-0"
                >✕</button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Rotation mode -->
      <div>
        <span class="block text-sm font-medium text-slate-300 mb-2">Mode rotation</span>
        <div class="grid grid-cols-2 gap-2">
          {#each [
            { value: 'CLASSIC', label: 'Classique', desc: 'Tout le monde tourne à chaque buzzer' },
            { value: 'FIXED', label: 'Fixe', desc: 'Chacun reste à sa station' },
          ] as m}
            <label class="flex flex-col gap-1 p-3 rounded-lg border cursor-pointer transition-colors
                          {rotationMode === m.value
                            ? 'border-sky-500 bg-sky-500/10'
                            : 'border-slate-700 hover:border-slate-600'}">
              <input type="radio" name="rotationMode" value={m.value}
                     bind:group={rotationMode} class="sr-only" />
              <span class="text-sm font-medium text-slate-200">{m.label}</span>
              <span class="text-xs text-slate-500">{m.desc}</span>
            </label>
          {/each}
        </div>
      </div>

      <!-- Durée estimée -->
      <div class="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-400">
        ⏱ Durée estimée :
        <span class="text-slate-200 font-semibold">~{estimatedMin()} min</span>
        · {stations.length} stations · {rounds} rounds
      </div>

      {#if error}
        <p class="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      {/if}

      <button
        type="submit"
        disabled={saving || !isValid}
        class="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500
               text-white font-semibold py-3 rounded-lg transition-colors text-sm"
      >
        {#if saving}Enregistrement…
        {:else if !isValid && stations.some((s) => s.exerciseIds.length === 0)}
          Assigner tous les exercices
        {:else}
          {submitLabel}
        {/if}
      </button>
    </div>

    <!-- ======== COLONNE DROITE : stations ======== -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Stations ({stations.length}/20)
        </h2>
        <button
          type="button"
          onclick={addStation}
          disabled={stations.length >= 20}
          class="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300
                 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
        >
          + Ajouter une station
        </button>
      </div>

      <div class="space-y-2">
        {#each stations as station, idx (idx)}
          {@const hasEx = station.exerciseIds.length > 0}
          <div class="bg-slate-900 border rounded-xl transition-colors
                      {hasEx ? 'border-slate-700' : 'border-amber-700/50'}">
            <div class="flex items-center gap-3 p-3">
              <!-- Numéro -->
              <span class="text-slate-500 font-mono text-sm w-6 shrink-0 text-center">
                {idx + 1}
              </span>

              <!-- Exercices assignés -->
              <button
                type="button"
                onclick={() => openPicker(idx)}
                class="flex-1 text-left min-w-0"
              >
                {#if station.exerciseIds.length > 0}
                  <div class="flex items-center gap-2 flex-wrap">
                    {#each station.exerciseIds as exId}
                      {@const ex = exerciseById(exId)}
                      {#if ex}
                        <div class="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2 py-1">
                          {#if ex.thumbnailUrl}
                            <img src={ex.thumbnailUrl} alt="" class="w-6 h-6 rounded object-cover" />
                          {/if}
                          <span class="text-xs text-slate-200 max-w-[120px] truncate">{ex.name}</span>
                        </div>
                      {/if}
                    {/each}
                    <span class="text-xs text-slate-500 hover:text-sky-400 transition-colors">
                      Modifier ›
                    </span>
                  </div>
                {:else}
                  <span class="text-sm text-amber-400/80 flex items-center gap-1.5">
                    <span>⚠️</span> Choisir un exercice
                  </span>
                {/if}
              </button>

              <!-- Actions -->
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" onclick={() => moveUp(idx)} disabled={idx === 0}
                        class="p-1 text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors"
                        title="Monter">↑</button>
                <button type="button" onclick={() => moveDown(idx)} disabled={idx === stations.length - 1}
                        class="p-1 text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors"
                        title="Descendre">↓</button>
                <button type="button" onclick={() => removeStation(idx)}
                        disabled={stations.length <= 2}
                        class="p-1 text-slate-600 hover:text-red-400 disabled:opacity-20 transition-colors"
                        title="Supprimer">✕</button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</form>

<!-- ======== PICKER D'EXERCICES (overlay) ======== -->
{#if pickerOpenIdx !== null}
  {@const idx = pickerOpenIdx}
  {@const selected = stations[idx]?.exerciseIds ?? []}

  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/60 z-40"
    role="button"
    tabindex="-1"
    aria-label="Fermer le picker"
    onclick={closePicker}
    onkeydown={(e) => e.key === 'Escape' && closePicker()}
  ></div>

  <!-- Panel -->
  <div class="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-700
              z-50 flex flex-col shadow-2xl">
    <!-- En-tête picker -->
    <div class="flex items-center justify-between p-4 border-b border-slate-800">
      <div>
        <p class="font-semibold text-slate-100">Station {idx + 1}</p>
        <p class="text-xs text-slate-400 mt-0.5">
          {selected.length} exercice{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}
        </p>
      </div>
      <button
        onclick={closePicker}
        class="text-slate-400 hover:text-slate-100 text-xl leading-none px-2"
      >✕</button>
    </div>

    <!-- Recherche -->
    <div class="p-3 border-b border-slate-800">
      <input
        type="search"
        bind:value={pickerSearch}
        placeholder="Rechercher un exercice…"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100
               placeholder:text-slate-500 focus:outline-none focus:border-sky-500 text-sm"
        autofocus
      />
    </div>

    <!-- Liste exercices -->
    <div class="flex-1 overflow-y-auto p-3 space-y-1">
      {#if filteredExercises.length === 0}
        <p class="text-center text-slate-500 py-8 text-sm">Aucun exercice trouvé</p>
      {:else}
        {#each filteredExercises as ex (ex.id)}
          {@const isSelected = selected.includes(ex.id)}
          <button
            type="button"
            onclick={() => toggleExercise(idx, ex.id)}
            class="w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left
                   {isSelected
                     ? 'bg-sky-500/20 border border-sky-500/40'
                     : 'hover:bg-slate-800 border border-transparent'}"
          >
            <!-- Thumbnail -->
            <div class="w-12 h-12 rounded-lg bg-slate-800 shrink-0 overflow-hidden">
              {#if ex.thumbnailUrl}
                <img src={ex.thumbnailUrl} alt="" class="w-full h-full object-cover" />
              {:else}
                <div class="w-full h-full flex items-center justify-center text-slate-600 text-lg">🎬</div>
              {/if}
            </div>

            <!-- Infos -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-100 truncate">{ex.name}</p>
              {#if ex.muscleGroups.length > 0}
                <p class="text-xs text-slate-500 truncate">{ex.muscleGroups.slice(0, 2).join(', ')}</p>
              {/if}
            </div>

            <!-- Check -->
            <div class="w-5 h-5 rounded-full shrink-0 border-2 flex items-center justify-center
                        {isSelected ? 'bg-sky-500 border-sky-500' : 'border-slate-600'}">
              {#if isSelected}
                <span class="text-white text-xs leading-none">✓</span>
              {/if}
            </div>
          </button>
        {/each}
      {/if}
    </div>

    <!-- Footer -->
    <div class="p-3 border-t border-slate-800">
      <button
        onclick={closePicker}
        class="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5
               rounded-lg transition-colors text-sm"
      >
        Confirmer ({selected.length} exercice{selected.length > 1 ? 's' : ''})
      </button>
    </div>
  </div>
{/if}
