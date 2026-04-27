<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';

  const nav = [
    { href: '/exercises', label: 'Exercices', icon: '🏋️' },
    { href: '/circuits',  label: 'Circuits',  icon: '🔄' },
    { href: '/session',   label: 'Session',   icon: '▶️' },
    { href: '/sessions',  label: 'Historique', icon: '📋' },
    { href: '/schedule',  label: 'Calendrier', icon: '📅' },
    { href: '/screens',   label: 'Écrans',    icon: '📺' },
    { href: '/tv',        label: 'TV Station', icon: '🖥️' },
    { href: '/tv/central', label: 'TV Centrale', icon: '📊' },
  ];

  let { children } = $props();

  // La page /tv gère son propre layout plein-écran
  const isTv = $derived($page.url.pathname.startsWith('/tv'));
</script>

{#if isTv}
  {@render children()}
{:else}
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
    <!-- Barre de navigation -->
    <nav class="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-6 shrink-0">
      <a href="/" class="font-bold text-sky-400 text-lg tracking-tight mr-2 hover:text-sky-300 transition-colors">
      Circuit Fit TV
    </a>
      {#each nav as item}
        <a
          href={item.href}
          class="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md transition-colors
            {$page.url.pathname.startsWith(item.href)
              ? 'bg-sky-500/20 text-sky-300'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}"
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>

    <!-- Contenu principal -->
    <main class="flex-1 overflow-auto">
      {@render children()}
    </main>
  </div>
{/if}
