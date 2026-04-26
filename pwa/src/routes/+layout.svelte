<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';

  const nav = [
    { href: '/exercises', label: 'Exercices', icon: '🏋️' },
    { href: '/circuits', label: 'Circuits', icon: '🔄' },
    { href: '/session', label: 'Session live', icon: '▶️' },
  ];

  let { children } = $props();
</script>

<div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
  <!-- Barre de navigation -->
  <nav class="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-6 shrink-0">
    <span class="font-bold text-sky-400 text-lg tracking-tight mr-2">Circuit Fit TV</span>
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
