<script lang="ts">
  import type { PageProps } from './$types';
  import { t } from '$lib/i18n.svelte.js';

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Circuit Fit TV</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto space-y-8">

  <!-- Hero -->
  <div class="text-center py-8">
    <h1 class="text-4xl font-black text-sky-400 tracking-tight">Circuit Fit TV</h1>
    <p class="text-slate-400 mt-2 text-lg">{t('home.subtitle')}</p>
  </div>

  <!-- Action principale -->
  <a
    href="/session"
    class="block bg-gradient-to-r from-emerald-600 to-sky-600 rounded-2xl p-6
           hover:from-emerald-500 hover:to-sky-500 transition-all group"
  >
    <div class="flex items-center justify-between">
      <div>
        <p class="text-2xl font-bold text-white">{t('home.startSession')}</p>
        <p class="text-white/70 mt-1">{t('home.startSessionDesc')}</p>
      </div>
      <span class="text-4xl group-hover:translate-x-1 transition-transform">&#x25B6;</span>
    </div>
  </a>

  <!-- Stats rapides -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <a href="/exercises" class="bg-slate-900 border border-slate-800 hover:border-slate-600
              rounded-xl p-5 transition-colors text-center">
      <p class="text-3xl font-bold text-slate-100">{data.exerciseCount}</p>
      <p class="text-sm text-slate-400 mt-1">{t('nav.exercises')}</p>
    </a>
    <a href="/circuits" class="bg-slate-900 border border-slate-800 hover:border-slate-600
              rounded-xl p-5 transition-colors text-center">
      <p class="text-3xl font-bold text-slate-100">{data.circuits.length}</p>
      <p class="text-sm text-slate-400 mt-1">{t('nav.circuits')}</p>
    </a>
    <a href="/tv" class="bg-slate-900 border border-slate-800 hover:border-slate-600
              rounded-xl p-5 transition-colors text-center">
      <p class="text-2xl">📺</p>
      <p class="text-sm text-slate-400 mt-1">{t('nav.tvStation')}</p>
    </a>
    <a href="/tv/central" class="bg-slate-900 border border-slate-800 hover:border-slate-600
              rounded-xl p-5 transition-colors text-center">
      <p class="text-2xl">🖥️</p>
      <p class="text-sm text-slate-400 mt-1">{t('nav.tvCentral')}</p>
    </a>
  </div>

  <!-- Circuits récents -->
  {#if data.circuits.length > 0}
    <div>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-slate-200">{t('nav.circuits')}</h2>
        <a href="/circuits" class="text-sm text-sky-400 hover:text-sky-300 transition-colors">
          {t('home.seeAll')}
        </a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        {#each data.circuits.slice(0, 4) as c (c.id)}
          <a
            href="/circuits/{c.id}"
            class="bg-slate-900 border border-slate-800 hover:border-slate-600
                   rounded-xl p-4 transition-colors flex items-center gap-4"
          >
            <div class="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center
                        text-xl font-bold text-sky-400 shrink-0">
              {c.stations.length}
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-slate-100 truncate">{c.name}</p>
              <p class="text-xs text-slate-500 mt-0.5">
                {c.rounds} rounds · {c.workSec}s/{c.restSec}s ·
                {c.stations.length} stations
              </p>
            </div>
          </a>
        {/each}
      </div>
    </div>
  {:else}
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
      <p class="text-slate-400">{t('home.noCircuits')}</p>
      <a href="/circuits/new" class="inline-block mt-3 text-sky-400 hover:text-sky-300 font-medium transition-colors">
        {t('home.createFirst')}
      </a>
    </div>
  {/if}
</div>
