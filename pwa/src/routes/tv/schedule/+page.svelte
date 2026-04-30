<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { studioSettings, loadSettings, applyBranding } from '$lib/settings.svelte.js';
  import { createWsConnection, type WsConnection } from '$lib/ws.svelte.js';
  import { loadTvConfig, type TvConfig } from '$lib/tvConfig.js';

  // ---- Types ----
  interface ScheduledClass {
    scheduleId: string;
    circuitId:  string;
    name:       string;
    icon:       string | null;
    timeHour:   number;
    timeMinute: string; // "09:30"
  }

  interface ScheduledDay {
    date:      string;
    label:     string;
    dayOfWeek: number;
    classes:   ScheduledClass[];
  }

  const API_BASE: string = import.meta.env['VITE_API_URL'] ?? '';

  // ---- State ----
  let days        = $state<ScheduledDay[]>([]);
  let loading     = $state(true);
  let now         = $state(new Date());
  let fetchError  = $state(false);
  let savedConfig = $state<TvConfig | null>(null);
  let conn        = $state<WsConnection | null>(null);

  // ---- Clock ----
  const clockInterval = setInterval(() => { now = new Date(); }, 1000);

  // ---- Fetch data ----
  async function fetchSchedule() {
    try {
      const res = await fetch(`${API_BASE}/tv-schedule`);
      if (res.ok) {
        days = await res.json() as ScheduledDay[];
        fetchError = false;
      } else {
        fetchError = true;
      }
    } catch {
      fetchError = true;
    } finally {
      loading = false;
    }
  }

  // Refresh every 5 minutes
  const refreshInterval = setInterval(fetchSchedule, 5 * 60 * 1000);

  onMount(async () => {
    await Promise.all([loadSettings(), fetchSchedule()]);
    const config = loadTvConfig();
    if (config?.mode === 'schedule') {
      savedConfig = config;
      conn = createWsConnection('tv', config.label, { displayId: config.displayId });
    }
    applyBranding();
  });

  onDestroy(() => {
    clearInterval(clockInterval);
    clearInterval(refreshInterval);
    conn?.destroy();
  });

  // ---- Helpers ----
  const todayStr = $derived(now.toISOString().slice(0, 10));

  function fmtClock(d: Date): string {
    return d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Is a class "next up" — today, not yet started (within 30 min) or currently running (within work duration)
  function isUpcoming(cls: ScheduledClass, dateStr: string): boolean {
    if (dateStr !== todayStr) return false;
    const [h, m] = cls.timeMinute.split(':').map(Number);
    if (h === undefined || m === undefined) return false;
    const classMinutes = h * 60 + m;
    const nowMinutes   = now.getHours() * 60 + now.getMinutes();
    return classMinutes >= nowMinutes && classMinutes <= nowMinutes + 90;
  }

  function isPast(cls: ScheduledClass, dateStr: string): boolean {
    if (dateStr !== todayStr) return false;
    const [h, m] = cls.timeMinute.split(':').map(Number);
    if (h === undefined || m === undefined) return false;
    const classMinutes = h * 60 + m;
    const nowMinutes   = now.getHours() * 60 + now.getMinutes();
    return classMinutes < nowMinutes - 5;
  }

  // Max classes in any day (for layout)
  const maxClasses = $derived(Math.max(1, ...days.map(d => d.classes.length)));
</script>

<svelte:head>
  <title>Calendrier — {studioSettings.studioName}</title>
</svelte:head>

<div class="fixed inset-0 bg-slate-950 flex flex-col overflow-hidden select-none" style="font-family: system-ui, -apple-system, sans-serif;">

  <!-- ══════════ HEADER ══════════ -->
  <header class="shrink-0 flex items-center justify-between px-8 py-4
                 border-b border-slate-800/80">

    <!-- Logo + studio name -->
    <div class="flex items-center gap-4">
      {#if studioSettings.logoUrl}
        <img src={studioSettings.logoUrl} alt="Logo" class="h-10 w-auto object-contain" />
      {/if}
      <div>
        <p class="text-xl font-black text-slate-100 leading-tight tracking-tight">
          {studioSettings.studioName}
        </p>
        <p class="text-xs text-slate-500 uppercase tracking-widest mt-0.5">Calendrier de la semaine</p>
      </div>
    </div>

    <!-- Clock -->
    <div class="text-right">
      <p class="text-4xl font-black tabular-nums text-slate-100 leading-none"
         style="color: var(--color-primary, #0ea5e9);">
        {fmtClock(now)}
      </p>
      <p class="text-xs text-slate-500 mt-1 uppercase tracking-widest">
        {capitalize(now.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }))}
      </p>
      {#if savedConfig}
        <p class="text-xs mt-2 {conn?.connected ? 'text-emerald-400' : 'text-amber-400'}">
          {conn?.connected ? 'LIVE' : 'Reconnexion...'}
        </p>
      {/if}
    </div>
  </header>

  <!-- ══════════ CALENDAR GRID ══════════ -->
  <main class="flex-1 overflow-hidden p-4 pt-3">

    {#if loading}
      <div class="h-full flex items-center justify-center">
        <div class="text-slate-600 text-lg tracking-widest uppercase animate-pulse">Chargement…</div>
      </div>

    {:else if fetchError}
      <div class="h-full flex items-center justify-center gap-3 text-red-500">
        <span class="text-2xl">⚠️</span>
        <p class="text-sm">Impossible de charger le calendrier</p>
      </div>

    {:else}
      <div class="h-full grid gap-2" style="grid-template-columns: repeat({days.length}, 1fr);">

        {#each days as day}
          {@const isToday = day.date === todayStr}
          <div
            class="flex flex-col rounded-2xl overflow-hidden transition-all duration-300
                   {isToday ? 'ring-2' : 'bg-slate-900/60'}"
            style="{isToday ? `ring-color: var(--color-primary, #0ea5e9); background: color-mix(in srgb, var(--color-primary, #0ea5e9) 8%, #0f172a);` : ''}"
          >

            <!-- Day header -->
            <div class="px-3 py-2.5 shrink-0 border-b
                        {isToday ? 'border-slate-700/60' : 'border-slate-800/60'}">
              <p class="text-xs font-bold uppercase tracking-widest
                         {isToday ? 'text-sky-400' : 'text-slate-500'}"
                 style="{isToday ? `color: var(--color-primary, #0ea5e9);` : ''}">
                {capitalize(new Date(day.date + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long' }))}
              </p>
              <p class="text-lg font-black leading-tight
                         {isToday ? 'text-slate-100' : 'text-slate-400'}">
                {new Date(day.date + 'T12:00:00').getDate()}
              </p>
              {#if isToday}
                <span class="inline-block text-xs font-bold px-1.5 py-0.5 rounded-md mt-0.5"
                      style="background: var(--color-primary, #0ea5e9); color: white; font-size: 0.6rem; letter-spacing: 0.1em;">
                  AUJOURD'HUI
                </span>
              {/if}
            </div>

            <!-- Classes list -->
            <div class="flex-1 flex flex-col gap-1.5 p-2 overflow-hidden">
              {#if day.classes.length === 0}
                <div class="flex-1 flex items-center justify-center">
                  <p class="text-slate-700 text-xs text-center">—</p>
                </div>
              {:else}
                {#each day.classes as cls}
                  {@const upcoming = isUpcoming(cls, day.date)}
                  {@const past     = isPast(cls, day.date)}
                  <div
                    class="rounded-xl px-2.5 py-2 flex items-center gap-2 transition-all duration-500
                           {upcoming
                             ? 'ring-1 shadow-lg'
                             : past
                               ? 'opacity-35'
                               : isToday
                                 ? 'bg-slate-800/60'
                                 : 'bg-slate-800/40'}"
                    style="{upcoming
                      ? `background: color-mix(in srgb, var(--color-primary, #0ea5e9) 15%, #1e293b); ring-color: var(--color-primary, #0ea5e9);`
                      : ''}"
                  >
                    <!-- Icon -->
                    <span class="text-xl shrink-0 leading-none">{cls.icon ?? '🏋️'}</span>

                    <!-- Info -->
                    <div class="min-w-0 flex-1">
                      <p class="text-xs font-bold truncate leading-tight
                                 {upcoming ? 'text-slate-100' : isToday && !past ? 'text-slate-200' : 'text-slate-400'}">
                        {cls.name}
                      </p>
                      <p class="text-xs mt-0.5 tabular-nums font-medium leading-tight
                                 {upcoming ? 'text-sky-300' : 'text-slate-500'}"
                         style="{upcoming ? `color: var(--color-primary, #0ea5e9);` : ''}">
                        {cls.timeMinute}
                      </p>
                    </div>

                    {#if upcoming}
                      <span class="shrink-0 text-xs font-black px-1.5 py-0.5 rounded-md animate-pulse"
                            style="background: var(--color-primary, #0ea5e9); color: white; font-size: 0.55rem; letter-spacing: 0.05em;">
                        PROCHAIN
                      </span>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>

          </div>
        {/each}

      </div>
    {/if}
  </main>

  <!-- ══════════ FOOTER ══════════ -->
  <footer class="shrink-0 flex items-center justify-between px-8 py-2 border-t border-slate-800/60">
    <p class="text-xs text-slate-700 tracking-widest uppercase">Circuit Fit TV</p>
    <p class="text-xs text-slate-700">Mise à jour automatique toutes les 5 min</p>
  </footer>

</div>
