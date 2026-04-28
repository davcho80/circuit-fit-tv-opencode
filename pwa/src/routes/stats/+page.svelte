<script lang="ts">
  import { stats as statsApi } from '$lib/api.js';
  import { t } from '$lib/i18n.svelte.js';

  let { data } = $props();
  const s = $derived(data.stats);

  // Construire le graphique 30 jours : tableau de 30 cases, 0 si pas de session
  const chartDays = $derived.by(() => {
    const map = new Map(s.byDay.map((d) => [d.day, d.count]));
    const result: Array<{ day: string; label: string; count: number }> = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      result.push({
        day:   key,
        label: d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }),
        count: map.get(key) ?? 0,
      });
    }
    return result;
  });

  const maxCount    = $derived(Math.max(1, ...chartDays.map((d) => d.count)));
  const abortedPct  = $derived(100 - s.completionRate);
</script>

<svelte:head>
  <title>Statistiques — Circuit Fit TV</title>
</svelte:head>

<div class="p-6 max-w-5xl mx-auto space-y-8">

  <!-- En-tête -->
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-2xl font-bold text-slate-100">{t('stats.title')}</h1>
      <p class="text-slate-400 text-sm mt-0.5">{t('stats.subtitle')}</p>
    </div>
    <a
      href={statsApi.exportCsvUrl()}
      download="sessions.csv"
      class="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200
             font-medium px-4 py-2 rounded-lg transition-colors text-sm border border-slate-700"
    >
      ⬇️ {t('stats.exportCsv')}
    </a>
  </div>

  <!-- Métriques clés -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p class="text-xs text-slate-500 uppercase tracking-widest mb-1">{t('stats.total')}</p>
      <p class="text-3xl font-bold text-slate-100">{s.total}</p>
    </div>
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p class="text-xs text-slate-500 uppercase tracking-widest mb-1">{t('stats.last7')}</p>
      <p class="text-3xl font-bold text-sky-400">{s.last7Days}</p>
    </div>
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p class="text-xs text-slate-500 uppercase tracking-widest mb-1">{t('stats.completionRate')}</p>
      <p class="text-3xl font-bold {s.completionRate >= 70 ? 'text-emerald-400' : s.completionRate >= 40 ? 'text-amber-400' : 'text-red-400'}">
        {s.completionRate}%
      </p>
    </div>
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p class="text-xs text-slate-500 uppercase tracking-widest mb-1">{t('stats.avgDuration')}</p>
      <p class="text-3xl font-bold text-slate-100">
        {s.avgDurationMin > 0 ? `${s.avgDurationMin} min` : '—'}
      </p>
    </div>
  </div>

  <!-- Graphique 30 jours -->
  <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
    <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-6">
      {t('stats.chart30')}
    </h2>
    <div class="flex items-end gap-1 h-32">
      {#each chartDays as d}
        <div class="flex-1 flex flex-col items-center gap-1 group relative">
          <div
            class="w-full rounded-t transition-all
                   {d.count > 0 ? 'bg-sky-500 group-hover:bg-sky-400' : 'bg-slate-800'}"
            style="height: {d.count === 0 ? '4px' : `${Math.max(8, (d.count / maxCount) * 112)}px`}"
          ></div>
          <!-- Tooltip -->
          {#if d.count > 0}
            <div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2
                        bg-slate-700 text-slate-100 text-xs px-2 py-1 rounded
                        whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
              {d.label} · {d.count} session{d.count > 1 ? 's' : ''}
            </div>
          {/if}
        </div>
      {/each}
    </div>
    <!-- Axe X : quelques labels -->
    <div class="flex justify-between mt-2 text-xs text-slate-600">
      <span>{chartDays[0]?.label}</span>
      <span>{chartDays[14]?.label}</span>
      <span>{chartDays[29]?.label}</span>
    </div>
  </div>

  <!-- Bas : top circuits + répartition statuts -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

    <!-- Top circuits -->
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">
        {t('stats.topCircuits')}
      </h2>
      {#if s.topCircuits.length === 0}
        <p class="text-slate-500 text-sm">{t('stats.noData')}</p>
      {:else}
        <ol class="space-y-3">
          {#each s.topCircuits as c, i}
            {@const pct = Math.round((c.count / s.total) * 100)}
            <li class="flex items-center gap-3">
              <span class="text-slate-600 text-sm w-5 text-right shrink-0">#{i + 1}</span>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline mb-1">
                  <span class="text-sm text-slate-200 truncate">{c.name}</span>
                  <span class="text-xs text-slate-500 shrink-0 ml-2">{c.count} × ({pct}%)</span>
                </div>
                <div class="h-1.5 bg-slate-800 rounded-full">
                  <div class="h-1.5 bg-sky-500 rounded-full" style="width: {pct}%"></div>
                </div>
              </div>
            </li>
          {/each}
        </ol>
      {/if}
    </div>

    <!-- Répartition terminée / arrêtée -->
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">
        {t('stats.results')}
      </h2>
      {#if s.total === 0}
        <p class="text-slate-500 text-sm">{t('stats.noSessions')}</p>
      {:else}
        <div class="space-y-4">
          <!-- Terminées -->
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span class="text-emerald-400 font-medium">✅ {t('stats.completed')}</span>
              <span class="text-slate-300">{s.completed} <span class="text-slate-500">({s.completionRate}%)</span></span>
            </div>
            <div class="h-2.5 bg-slate-800 rounded-full">
              <div class="h-2.5 bg-emerald-500 rounded-full transition-all" style="width: {s.completionRate}%"></div>
            </div>
          </div>
          <!-- Arrêtées -->
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span class="text-slate-400 font-medium">⏹ {t('stats.aborted')}</span>
              <span class="text-slate-300">{s.aborted} <span class="text-slate-500">({abortedPct}%)</span></span>
            </div>
            <div class="h-2.5 bg-slate-800 rounded-full">
              <div class="h-2.5 bg-slate-600 rounded-full transition-all" style="width: {abortedPct}%"></div>
            </div>
          </div>

          <!-- Totaux 7j / 30j -->
          <div class="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
            <div class="text-center">
              <p class="text-2xl font-bold text-sky-400">{s.last7Days}</p>
              <p class="text-xs text-slate-500 mt-0.5">{t('stats.last7')}</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-slate-300">{s.last30Days}</p>
              <p class="text-xs text-slate-500 mt-0.5">{t('stats.last30')}</p>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
