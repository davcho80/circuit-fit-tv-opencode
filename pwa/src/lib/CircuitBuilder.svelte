<!--
  CircuitBuilder — formulaire complet pour créer ou modifier un circuit.

  Props :
    initial  : données existantes (mode édition) ou undefined (mode création)
    exercises: liste complète des exercices disponibles
    onsubmit : appelé avec le payload CircuitCreate validé
-->
<script lang="ts">
  import type { Circuit, CircuitCreate, Exercise } from './api';
  import { t } from './i18n.svelte.js';

  interface Props {
    initial?: Circuit;
    exercises: Exercise[];
    onsubmit: (data: CircuitCreate) => Promise<void>;
    submitLabel?: string;
  }

  let { initial, exercises, onsubmit, submitLabel = 'Enregistrer' }: Props = $props();

  // ---- État du formulaire ----
  let name = $state(initial?.name ?? '');
  let icon = $state(initial?.icon ?? '');
  let description = $state(initial?.description ?? '');
  let rounds = $state(initial?.rounds ?? 3);
  let workSec = $state(initial?.workSec ?? 40);
  let restSec = $state(initial?.restSec ?? 20);
  let transitionSec = $state(initial?.transitionSec ?? 10);
  let warmupSec = $state(initial?.warmupSec ?? 0);
  let cooldownSec = $state(initial?.cooldownSec ?? 0);
  let coachNotes = $state(initial?.coachNotes ?? '');
  let whiteboardEnabled = $state(initial?.whiteboardEnabled ?? true);
  let rotationMode = $state<'CLASSIC' | 'FIXED'>(initial?.rotationMode ?? 'CLASSIC');

  // Stations locales
  interface LocalExerciseConfig {
    exerciseId: string;
    setsEnabled: boolean;
    sets: number;
    reps: number;
  }

  interface LocalStation {
    exercises: LocalExerciseConfig[];
  }
  let stations = $state<LocalStation[]>(
    initial?.stations.map((s) => ({
      exercises: s.exercises.map((e) => ({
        exerciseId: e.exercise.id,
        setsEnabled: e.sets !== null && e.reps !== null,
        sets: e.sets ?? 3,
        reps: e.reps ?? 10,
      })),
    })) ?? [
      { exercises: [] },
      { exercises: [] },
    ],
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
    const selected = stations[stationIdx]!.exercises;
    if (selected.some((config) => config.exerciseId === exerciseId)) {
      stations[stationIdx]!.exercises = selected.filter((config) => config.exerciseId !== exerciseId);
    } else {
      stations[stationIdx]!.exercises = [...selected, { exerciseId, setsEnabled: false, sets: 3, reps: 10 }];
    }
  }

  // ---- Gestion des stations ----
  function defaultStation(): LocalStation {
    return { exercises: [] };
  }

  function addStation() {
    if (stations.length >= 20) return;
    stations = [...stations, defaultStation()];
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
    if (s.exercises.length === 0) return t('cb.noExercise');
    return s.exercises
      .map((config) => exerciseById(config.exerciseId)?.name ?? '?')
      .join(' / ');
  }

  function stationExerciseIds(s: LocalStation): string[] {
    return s.exercises.map((config) => config.exerciseId);
  }

  // ---- Durée estimée ----
  let estimatedMin = $derived(() => {
    const n = stations.length;
    const setup = warmupSec + cooldownSec;
    const perRound = (workSec + restSec) * n + transitionSec * Math.max(0, n - 1);
    return Math.round((setup + perRound * rounds) / 60);
  });

  // ---- Validation & submit ----
  let saving = $state(false);
  let error = $state('');

  let isValid = $derived(
    name.trim().length > 0 &&
    stations.length >= 2 &&
    stations.every((s) => (
      s.exercises.length > 0 &&
      s.exercises.every((config) => (
        !config.setsEnabled ||
        (
          Number.isInteger(config.sets) &&
          Number.isInteger(config.reps) &&
          config.sets >= 1 &&
          config.sets <= 20 &&
          config.reps >= 1 &&
          config.reps <= 200
        )
      ))
    )),
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
        icon: icon.trim() || null,
        rounds,
        workSec,
        restSec,
        transitionSec,
        warmupSec,
        cooldownSec,
        coachNotes: coachNotes.trim() || null,
        whiteboardEnabled,
        rotationMode,
        stations: stations.map((s, i) => ({
          position:          i + 1,
          exerciseIds:       stationExerciseIds(s),
          exerciseConfigs:   s.exercises
            .filter((config) => config.setsEnabled)
            .map((config) => ({
              exerciseId: config.exerciseId,
              sets:       config.sets,
              reps:       config.reps,
            })),
          stationMode:       'TIME',
          sets:              null,
          reps:              null,
          restBetweenSetsSec: null,
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
      <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">{t('cb.params')}</h2>

      <!-- Nom -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1" for="c-name">{t('cb.name')}</label>
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

      <!-- Icône (emoji) -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1" for="c-icon">
          {t('cb.icon')} <span class="text-slate-500 font-normal text-xs ml-1">{t('cb.iconHint')}</span>
        </label>
        <div class="flex items-center gap-3">
          <div class="w-12 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center
                      justify-center text-2xl select-none">
            {icon || '🏋️'}
          </div>
          <input
            id="c-icon"
            type="text"
            bind:value={icon}
            maxlength="2"
            placeholder="🏋️"
            class="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xl
                   text-center focus:outline-none focus:border-sky-500"
          />
          <p class="text-xs text-slate-500">{t('cb.iconDesc')}</p>
        </div>
      </div>

      <!-- Description -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1" for="c-desc">{t('cb.desc')}</label>
        <textarea
          id="c-desc"
          bind:value={description}
          maxlength="500" rows="2"
          placeholder={t('cb.descPlaceholder')}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100
                 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 text-sm resize-none"
        ></textarea>
      </div>

      <!-- Rounds -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-2" for="c-rounds">
          {t('cb.rounds')} — <span class="text-sky-400 font-semibold">{rounds}</span>
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
          <label class="block text-xs font-medium text-slate-400 mb-1" for="c-work">{t('cb.work')}</label>
          <input id="c-work" type="number" min={5} max={600} bind:value={workSec}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                   text-slate-100 text-sm text-center focus:outline-none focus:border-sky-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1" for="c-rest">{t('cb.rest')}</label>
          <input id="c-rest" type="number" min={0} max={300} bind:value={restSec}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                   text-slate-100 text-sm text-center focus:outline-none focus:border-sky-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1" for="c-trans">{t('cb.transition')}</label>
          <input id="c-trans" type="number" min={0} max={60} bind:value={transitionSec}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                   text-slate-100 text-sm text-center focus:outline-none focus:border-sky-500" />
        </div>
      </div>

      <!-- Circuit V2 : avant/après cours -->
      <div class="space-y-3 border border-slate-800 rounded-lg p-3 bg-slate-900/40">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm font-medium text-slate-300">Avant/après cours</span>
          <label class="inline-flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              bind:checked={whiteboardEnabled}
              class="accent-sky-500"
            />
            Whiteboard
          </label>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-xs font-medium text-slate-400" for="c-warmup">
            Warmup
            <select
              id="c-warmup"
              bind:value={warmupSec}
              class="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                     text-slate-100 text-sm focus:outline-none focus:border-sky-500"
            >
              {#each [[0,'Aucun'],[180,'3 min'],[300,'5 min'],[600,'10 min'],[900,'15 min']] as [s, lbl]}
                <option value={s}>{lbl}</option>
              {/each}
            </select>
          </label>
          <label class="block text-xs font-medium text-slate-400" for="c-cooldown">
            Cooldown
            <select
              id="c-cooldown"
              bind:value={cooldownSec}
              class="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                     text-slate-100 text-sm focus:outline-none focus:border-sky-500"
            >
              {#each [[0,'Aucun'],[120,'2 min'],[180,'3 min'],[300,'5 min'],[600,'10 min']] as [s, lbl]}
                <option value={s}>{lbl}</option>
              {/each}
            </select>
          </label>
        </div>
        <label class="block text-xs font-medium text-slate-400" for="c-coach-notes">
          Note coach / whiteboard
          <textarea
            id="c-coach-notes"
            bind:value={coachNotes}
            maxlength="1000"
            rows="3"
            placeholder="Objectif du cours, consignes, adaptations..."
            class="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100
                   placeholder:text-slate-500 focus:outline-none focus:border-sky-500 text-sm resize-none"
          ></textarea>
        </label>
      </div>

      <!-- Pauses eau programmées -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-slate-300">{t('cb.breaks')}</span>
          <button
            type="button"
            onclick={addBreak}
            disabled={scheduledBreaks.length >= rounds - 1}
            class="text-xs bg-slate-800 hover:bg-cyan-700/50 disabled:opacity-30
                   text-slate-300 hover:text-cyan-200 px-2.5 py-1 rounded-lg transition-colors
                   border border-slate-700"
          >
            {t('cb.addBreak')}
          </button>
        </div>

        {#if scheduledBreaks.length === 0}
          <p class="text-xs text-slate-500 italic">{t('cb.noBreaks')}</p>
        {:else}
          <div class="space-y-1.5">
            {#each scheduledBreaks as brk, idx}
              <div class="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50">
                <span class="text-cyan-400 text-sm shrink-0">💧</span>
                <span class="text-xs text-slate-400 shrink-0">{t('cb.afterRound')}</span>
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
        <span class="block text-sm font-medium text-slate-300 mb-2">{t('cb.rotMode')}</span>
        <div class="grid grid-cols-2 gap-2">
          {#each [
            { value: 'CLASSIC', label: t('cb.rotClassic'), desc: t('cb.rotClassicDesc') },
            { value: 'FIXED', label: t('cb.rotFixed'), desc: t('cb.rotFixedDesc') },
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
        {t('cb.estDuration')}
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
        {#if saving}{t('cb.saving')}
        {:else if !isValid && stations.some((s) => s.exercises.length === 0)}
          {t('cb.assignAll')}
        {:else}
          {submitLabel}
        {/if}
      </button>
    </div>

    <!-- ======== COLONNE DROITE : stations ======== -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          {t('cb.stations')} ({stations.length}/20)
        </h2>
        <button
          type="button"
          onclick={addStation}
          disabled={stations.length >= 20}
          class="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300
                 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
        >
          {t('cb.addStation')}
        </button>
      </div>

      <div class="space-y-2">
        {#each stations as station, idx (idx)}
          {@const hasEx = station.exercises.length > 0}
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
                {#if station.exercises.length > 0}
                  <div class="flex items-center gap-2 flex-wrap">
                    {#each station.exercises as config}
                      {@const ex = exerciseById(config.exerciseId)}
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
                      {t('cb.editExercise')}
                    </span>
                  </div>
                {:else}
                  <span class="text-sm text-amber-400/80 flex items-center gap-1.5">
                    {t('cb.pickExercise')}
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

            <div class="border-t border-slate-800 px-3 py-2">
              <span class="text-xs text-slate-500">
                {workSec}s travail · {restSec}s repos
              </span>
            </div>

            {#if station.exercises.length > 0}
              <div class="border-t border-slate-800 px-3 py-2 space-y-2">
                {#each station.exercises as config (config.exerciseId)}
                  {@const ex = exerciseById(config.exerciseId)}
                  {#if ex}
                    <div class="flex flex-wrap items-center gap-2 rounded-lg bg-slate-950/50 px-2 py-2">
                      <label class="flex items-center gap-2 min-w-0 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          bind:checked={config.setsEnabled}
                          class="h-4 w-4 rounded border-slate-600 bg-slate-800 text-sky-500"
                        />
                        <span class="truncate max-w-[130px]">{ex.name}</span>
                        <span class="text-slate-500">set et rep</span>
                      </label>

                      {#if config.setsEnabled}
                        <div class="ml-auto flex items-center gap-1.5">
                          <label class="flex items-center gap-1 text-xs text-slate-400">
                            Sets
                            <input
                              type="number"
                              min="1"
                              max="20"
                              bind:value={config.sets}
                              class="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1
                                     text-slate-100 text-xs text-center focus:outline-none focus:border-sky-500"
                            />
                          </label>
                          <label class="flex items-center gap-1 text-xs text-slate-400">
                            Reps
                            <input
                              type="number"
                              min="1"
                              max="200"
                              bind:value={config.reps}
                              class="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1
                                     text-slate-100 text-xs text-center focus:outline-none focus:border-sky-500"
                            />
                          </label>
                        </div>
                      {/if}
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</form>

<!-- ======== PICKER D'EXERCICES (overlay) ======== -->
{#if pickerOpenIdx !== null}
  {@const idx = pickerOpenIdx}
  {@const selected = stationExerciseIds(stations[idx] ?? defaultStation())}

  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/60 z-40"
    role="button"
    tabindex="-1"
    aria-label={t('cb.stationLabel')}
    onclick={closePicker}
    onkeydown={(e) => e.key === 'Escape' && closePicker()}
  ></div>

  <!-- Panel -->
  <div class="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-700
              z-50 flex flex-col shadow-2xl">
    <!-- En-tête picker -->
    <div class="flex items-center justify-between p-4 border-b border-slate-800">
      <div>
        <p class="font-semibold text-slate-100">{t('cb.stationLabel')} {idx + 1}</p>
        <p class="text-xs text-slate-400 mt-0.5">({selected.length})</p>
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
        placeholder={t('cb.searchEx')}
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100
               placeholder:text-slate-500 focus:outline-none focus:border-sky-500 text-sm"
        autofocus
      />
    </div>

    <!-- Liste exercices -->
    <div class="flex-1 overflow-y-auto p-3 space-y-1">
      {#if filteredExercises.length === 0}
        <p class="text-center text-slate-500 py-8 text-sm">{t('cb.noExFound')}</p>
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
