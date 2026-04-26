<!-- Formulaire partagé Créer / Modifier un exercice -->
<script lang="ts">
  import type { Exercise, ExerciseCreate, Difficulty } from './api';

  interface Props {
    initial?: Partial<Exercise>;
    onsubmit: (data: ExerciseCreate) => Promise<void>;
    submitLabel?: string;
  }

  let { initial = {}, onsubmit, submitLabel = 'Enregistrer' }: Props = $props();

  let name = $state(initial.name ?? '');
  let description = $state(initial.description ?? '');
  let difficulty = $state<Difficulty>(initial.difficulty ?? 'BEGINNER');
  let muscleGroupsRaw = $state((initial.muscleGroups ?? []).join(', '));
  let equipmentRaw = $state((initial.equipment ?? []).join(', '));
  let saving = $state(false);
  let error = $state('');

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    saving = true;
    try {
      await onsubmit({
        name: name.trim(),
        description: description.trim() || null,
        difficulty,
        muscleGroups: muscleGroupsRaw.split(',').map((s) => s.trim()).filter(Boolean),
        equipment: equipmentRaw.split(',').map((s) => s.trim()).filter(Boolean),
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }

  const difficulties: { value: Difficulty; label: string }[] = [
    { value: 'BEGINNER', label: 'Débutant' },
    { value: 'INTERMEDIATE', label: 'Intermédiaire' },
    { value: 'ADVANCED', label: 'Avancé' },
  ];
</script>

<form onsubmit={handleSubmit} class="space-y-5">
  <!-- Nom -->
  <div>
    <label class="block text-sm font-medium text-slate-300 mb-1" for="name">Nom *</label>
    <input
      id="name"
      type="text"
      bind:value={name}
      required
      maxlength="100"
      placeholder="Ex : Squat, Burpee, Kettlebell swing…"
      class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100
             placeholder:text-slate-500 focus:outline-none focus:border-sky-500 text-sm"
    />
  </div>

  <!-- Description -->
  <div>
    <label class="block text-sm font-medium text-slate-300 mb-1" for="desc">Description</label>
    <textarea
      id="desc"
      bind:value={description}
      maxlength="280"
      rows="2"
      placeholder="Instructions courtes, consignes de sécurité…"
      class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100
             placeholder:text-slate-500 focus:outline-none focus:border-sky-500 text-sm resize-none"
    ></textarea>
  </div>

  <!-- Difficulté -->
  <div>
    <span class="block text-sm font-medium text-slate-300 mb-2">Niveau</span>
    <div class="flex gap-3">
      {#each difficulties as d}
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="difficulty"
            value={d.value}
            bind:group={difficulty}
            class="accent-sky-500"
          />
          <span class="text-sm text-slate-300">{d.label}</span>
        </label>
      {/each}
    </div>
  </div>

  <!-- Muscles -->
  <div>
    <label class="block text-sm font-medium text-slate-300 mb-1" for="muscles">
      Groupes musculaires <span class="text-slate-500 font-normal">(séparés par des virgules)</span>
    </label>
    <input
      id="muscles"
      type="text"
      bind:value={muscleGroupsRaw}
      placeholder="Ex : Quadriceps, Fessiers, Ischio-jambiers"
      class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100
             placeholder:text-slate-500 focus:outline-none focus:border-sky-500 text-sm"
    />
  </div>

  <!-- Équipement -->
  <div>
    <label class="block text-sm font-medium text-slate-300 mb-1" for="equip">
      Équipement <span class="text-slate-500 font-normal">(séparés par des virgules)</span>
    </label>
    <input
      id="equip"
      type="text"
      bind:value={equipmentRaw}
      placeholder="Ex : Haltères, Kettlebell, Aucun"
      class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100
             placeholder:text-slate-500 focus:outline-none focus:border-sky-500 text-sm"
    />
  </div>

  {#if error}
    <p class="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
  {/if}

  <button
    type="submit"
    disabled={saving || !name.trim()}
    class="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500
           text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
  >
    {saving ? 'Enregistrement…' : submitLabel}
  </button>
</form>
