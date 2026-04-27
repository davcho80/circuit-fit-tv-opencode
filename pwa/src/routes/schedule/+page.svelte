<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { schedules as api, type Schedule, type ScheduleCreate } from '$lib/api.js';

  let { data } = $props();

  // ---- Constantes ----

  const DAY_LABELS = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const DAY_FULL   = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  // Aperçu : 14 prochains jours
  const PREVIEW_DAYS = 14;

  // ---- État formulaire ----

  const EMPTY_FORM: ScheduleCreate = {
    circuitId:  '',
    name:       '',
    daysOfWeek: [],
    timeHour:   9,
    timeMinute: 0,
    timezone:   'America/Montreal',
    startDate:  today(),
    endDate:    null,
    isActive:   true,
  };

  let showForm    = $state(false);
  let editId      = $state<string | null>(null);
  let form        = $state<ScheduleCreate>({ ...EMPTY_FORM });
  let saving      = $state(false);
  let error       = $state<string | null>(null);
  let deleteId    = $state<string | null>(null);

  // ---- Helpers date ----

  function today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function isoToDisplay(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso.slice(0, 10) + 'T12:00:00');
    return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  // ---- Calendrier 14 jours ----

  interface CalendarEntry {
    date:  string;        // YYYY-MM-DD
    label: string;        // "Lun 26 avr"
    items: Schedule[];
  }

  const calendar = $derived.by((): CalendarEntry[] => {
    const entries: CalendarEntry[] = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);

    for (let i = 0; i < PREVIEW_DAYS; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);

      const isoDate  = d.toISOString().slice(0, 10);
      const jsDay    = d.getDay(); // 0=Sun
      const isoDay   = jsDay === 0 ? 7 : jsDay;
      const dayShort = DAY_LABELS[isoDay];
      const dateStr  = d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });

      const items = data.schedules.filter((s) => {
        if (!s.isActive) return false;
        if (!s.daysOfWeek.includes(isoDay)) return false;
        if (isoDate < s.startDate.slice(0, 10)) return false;
        if (s.endDate && isoDate > s.endDate.slice(0, 10)) return false;
        return true;
      });

      entries.push({ date: isoDate, label: `${dayShort} ${dateStr}`, items });
    }

    return entries;
  });

  // ---- Toggle jour de la semaine ----

  function toggleDay(d: number) {
    if (form.daysOfWeek.includes(d)) {
      form.daysOfWeek = form.daysOfWeek.filter((x) => x !== d);
    } else {
      form.daysOfWeek = [...form.daysOfWeek, d].sort((a, b) => a - b);
    }
  }

  // ---- Ouvrir formulaire création ----

  function openCreate() {
    editId   = null;
    form     = { ...EMPTY_FORM, startDate: today() };
    error    = null;
    showForm = true;
  }

  // ---- Ouvrir formulaire édition ----

  function openEdit(s: Schedule) {
    editId = s.id;
    form   = {
      circuitId:  s.circuitId,
      name:       s.name,
      daysOfWeek: [...s.daysOfWeek],
      timeHour:   s.timeHour,
      timeMinute: s.timeMinute,
      timezone:   s.timezone,
      startDate:  s.startDate.slice(0, 10),
      endDate:    s.endDate ? s.endDate.slice(0, 10) : null,
      isActive:   s.isActive,
    };
    error    = null;
    showForm = true;
  }

  // ---- Soumettre formulaire ----

  async function submit() {
    error = null;

    if (!form.circuitId) { error = 'Choisir un circuit'; return; }
    if (!form.name.trim()) { error = 'Nom requis'; return; }
    if (form.daysOfWeek.length === 0) { error = 'Choisir au moins un jour'; return; }
    if (!form.startDate) { error = 'Date de début requise'; return; }

    saving = true;
    try {
      const payload: ScheduleCreate = {
        ...form,
        endDate: form.endDate || null,
      };

      if (editId) {
        await api.update(editId, payload);
      } else {
        await api.create(payload);
      }

      showForm = false;
      await invalidateAll();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Erreur inconnue';
    } finally {
      saving = false;
    }
  }

  // ---- Supprimer ----

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await api.delete(deleteId);
      deleteId = null;
      await invalidateAll();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Erreur suppression';
      deleteId = null;
    }
  }

  // ---- Toggle actif/inactif ----

  async function toggleActive(s: Schedule) {
    await api.update(s.id, { isActive: !s.isActive });
    await invalidateAll();
  }
</script>

<div class="p-6 max-w-5xl mx-auto space-y-8">

  <!-- En-tête -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-slate-100">Calendrier</h1>
      <p class="text-slate-400 text-sm mt-0.5">Planifier les sessions récurrentes</p>
    </div>
    <button
      onclick={openCreate}
      class="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
    >
      <span class="text-base">+</span> Nouvelle cédule
    </button>
  </div>

  <!-- Aperçu 14 jours -->
  <section>
    <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Prochains 14 jours</h2>
    <div class="grid grid-cols-7 gap-2">
      {#each calendar as day}
        {@const hasItems = day.items.length > 0}
        <div
          class="rounded-lg border p-2 min-h-16 text-xs
            {hasItems
              ? 'border-sky-700 bg-sky-950/60'
              : 'border-slate-800 bg-slate-900/40'}"
        >
          <div class="font-semibold {hasItems ? 'text-sky-300' : 'text-slate-500'} mb-1">{day.label}</div>
          {#each day.items as item}
            <div class="bg-sky-600/30 text-sky-200 rounded px-1.5 py-0.5 mb-0.5 truncate">
              {pad(item.timeHour)}:{pad(item.timeMinute)} {item.circuit.name}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </section>

  <!-- Liste des cédules -->
  <section>
    <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Toutes les cédules</h2>

    {#if data.schedules.length === 0}
      <div class="text-slate-500 text-sm py-8 text-center border border-slate-800 rounded-xl">
        Aucune cédule. Créez-en une pour démarrer automatiquement vos sessions.
      </div>
    {:else}
      <div class="space-y-2">
        {#each data.schedules as s (s.id)}
          <div class="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3
            {s.isActive ? '' : 'opacity-50'}">

            <!-- Actif toggle -->
            <button
              onclick={() => toggleActive(s)}
              class="w-9 h-5 rounded-full transition-colors relative shrink-0
                {s.isActive ? 'bg-sky-600' : 'bg-slate-700'}"
              title={s.isActive ? 'Désactiver' : 'Activer'}
            >
              <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                {s.isActive ? 'translate-x-4' : 'translate-x-0'}"></span>
            </button>

            <!-- Info principale -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-slate-100 truncate">{s.name}</span>
                <span class="text-slate-500 text-xs">{s.circuit.name}</span>
              </div>
              <div class="text-slate-400 text-xs mt-0.5 flex flex-wrap gap-x-3">
                <span>
                  {s.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')}
                  à {pad(s.timeHour)}:{pad(s.timeMinute)}
                </span>
                <span>{s.timezone}</span>
                <span>Du {isoToDisplay(s.startDate)}{s.endDate ? ` au ${isoToDisplay(s.endDate)}` : ' (sans fin)'}</span>
              </div>
            </div>

            <!-- Dernier déclenchement -->
            <div class="text-xs text-slate-500 shrink-0 hidden sm:block">
              {#if s.lastFiredAt}
                Dernier : {new Date(s.lastFiredAt).toLocaleString('fr-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {:else}
                Jamais déclenché
              {/if}
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 shrink-0">
              <button
                onclick={() => openEdit(s)}
                class="text-slate-400 hover:text-slate-100 p-1.5 rounded transition-colors"
                title="Modifier"
              >
                ✏️
              </button>
              <button
                onclick={() => { deleteId = s.id; }}
                class="text-slate-400 hover:text-red-400 p-1.5 rounded transition-colors"
                title="Supprimer"
              >
                🗑️
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<!-- ============================================================
     Modal formulaire
     ============================================================ -->

{#if showForm}
  <!-- Overlay -->
  <div
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4"
    role="presentation"
    onclick={(e) => { if (e.target === e.currentTarget) showForm = false; }}
  >
    <div
      class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl z-50"
      role="dialog"
      aria-modal="true"
      aria-label={editId ? 'Modifier la cédule' : 'Nouvelle cédule'}
    >
      <div class="px-6 pt-6 pb-4 border-b border-slate-800 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-100">
          {editId ? 'Modifier la cédule' : 'Nouvelle cédule'}
        </h2>
        <button onclick={() => { showForm = false; }} class="text-slate-400 hover:text-slate-100 text-xl leading-none">×</button>
      </div>

      <div class="px-6 py-5 space-y-5">

        <!-- Nom -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1.5">Nom</label>
          <input
            bind:value={form.name}
            type="text"
            placeholder="ex: Lundi cardio"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
        </div>

        <!-- Circuit -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1.5">Circuit</label>
          <select
            bind:value={form.circuitId}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <option value="">-- Choisir un circuit --</option>
            {#each data.circuits as c}
              <option value={c.id}>{c.name}</option>
            {/each}
          </select>
        </div>

        <!-- Jours de la semaine -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">Jours</label>
          <div class="flex gap-2 flex-wrap">
            {#each [1,2,3,4,5,6,7] as d}
              {@const active = form.daysOfWeek.includes(d)}
              <button
                type="button"
                onclick={() => toggleDay(d)}
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  {active
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100'}"
              >
                {DAY_FULL[d]}
              </button>
            {/each}
          </div>
        </div>

        <!-- Heure -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Heure</label>
            <input
              type="number"
              min="0" max="23"
              bind:value={form.timeHour}
              class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Minute</label>
            <input
              type="number"
              min="0" max="59"
              bind:value={form.timeMinute}
              class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>
        </div>

        <!-- Timezone -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1.5">Fuseau horaire</label>
          <select
            bind:value={form.timezone}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <option value="America/Montreal">America/Montreal (EST/EDT)</option>
            <option value="America/Toronto">America/Toronto</option>
            <option value="America/Vancouver">America/Vancouver (PST/PDT)</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Chicago">America/Chicago</option>
            <option value="America/Denver">America/Denver</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="Europe/Paris">Europe/Paris</option>
            <option value="UTC">UTC</option>
          </select>
        </div>

        <!-- Dates -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Date de début</label>
            <input
              type="date"
              bind:value={form.startDate}
              class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Date de fin <span class="text-slate-500 font-normal">(optionnel)</span></label>
            <input
              type="date"
              bind:value={form.endDate}
              class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>
        </div>

        <!-- Actif -->
        <label class="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            bind:checked={form.isActive}
            class="w-4 h-4 accent-sky-500"
          />
          <span class="text-sm text-slate-300">Cédule active</span>
        </label>

        <!-- Erreur -->
        {#if error}
          <div class="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </div>
        {/if}
      </div>

      <!-- Boutons -->
      <div class="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
        <button
          onclick={() => { showForm = false; }}
          class="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors"
        >
          Annuler
        </button>
        <button
          onclick={submit}
          disabled={saving}
          class="px-5 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {saving ? 'Enregistrement…' : (editId ? 'Enregistrer' : 'Créer')}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ============================================================
     Dialog confirmation suppression
     ============================================================ -->

{#if deleteId}
  <div
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    role="presentation"
    onclick={(e) => { if (e.target === e.currentTarget) deleteId = null; }}
  >
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4">
      <div class="text-4xl">🗑️</div>
      <p class="text-slate-200 font-medium">Supprimer cette cédule ?</p>
      <p class="text-slate-400 text-sm">Cette action est irréversible.</p>
      <div class="flex gap-3 justify-center pt-2">
        <button
          onclick={() => { deleteId = null; }}
          class="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 bg-slate-800 rounded-lg transition-colors"
        >
          Annuler
        </button>
        <button
          onclick={confirmDelete}
          class="px-4 py-2 text-sm font-medium bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          Supprimer
        </button>
      </div>
    </div>
  </div>
{/if}
