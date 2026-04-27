<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/auth.svelte.js';

  const nav = [
    { href: '/exercises', label: 'Exercices', icon: '🏋️' },
    { href: '/circuits',  label: 'Circuits',  icon: '🔄' },
    { href: '/session',   label: 'Session',   icon: '▶️' },
    { href: '/sessions',  label: 'Historique', icon: '📋' },
    { href: '/stats',     label: 'Stats',      icon: '📈' },
    { href: '/schedule',  label: 'Calendrier', icon: '📅' },
    { href: '/screens',   label: 'Écrans',    icon: '📺' },
    { href: '/tv',        label: 'TV Station', icon: '🖥️' },
    { href: '/tv/central', label: 'TV Centrale', icon: '📊' },
  ];

  let { children } = $props();

  // La page /tv gère son propre layout plein-écran
  const isTv = $derived($page.url.pathname.startsWith('/tv'));
  // Pages d'auth : pas de barre de navigation
  const isAuthPage = $derived(
    $page.url.pathname.startsWith('/login') ||
    $page.url.pathname.startsWith('/change-password') ||
    $page.url.pathname.startsWith('/setup'),
  );

  async function handleLogout() {
    await authStore.logout();
    goto('/login');
  }

  const roleLabel: Record<string, string> = { ADMIN: 'Admin', COACH: 'Coach' };
</script>

{#if isTv}
  {@render children()}
{:else if isAuthPage}
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
    {@render children()}
  </div>
{:else}
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
    <!-- Barre de navigation -->
    <nav class="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-4 shrink-0 overflow-x-auto">
      <a href="/" class="font-bold text-sky-400 text-lg tracking-tight mr-2 hover:text-sky-300 transition-colors shrink-0">
        Circuit Fit TV
      </a>
      {#each nav as item}
        <!-- Masquer le lien Utilisateurs dans la nav principale; il n'y est pas mais réservé à /users -->
        <a
          href={item.href}
          class="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md transition-colors shrink-0
            {$page.url.pathname.startsWith(item.href)
              ? 'bg-sky-500/20 text-sky-300'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}"
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </a>
      {/each}

      {#if authStore.isAdmin}
        <a
          href="/users"
          class="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md transition-colors shrink-0
            {$page.url.pathname.startsWith('/users')
              ? 'bg-sky-500/20 text-sky-300'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}"
        >
          <span>👥</span>
          <span>Utilisateurs</span>
        </a>
      {/if}

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Utilisateur connecté -->
      {#if authStore.user}
        <div class="flex items-center gap-3 shrink-0">
          <div class="text-right">
            <p class="text-xs text-slate-300 font-medium leading-tight">{authStore.user.email}</p>
            <p class="text-xs text-slate-500 leading-tight">{roleLabel[authStore.user.role] ?? authStore.user.role}</p>
          </div>
          <button
            onclick={handleLogout}
            class="text-xs font-medium px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700
                   text-slate-400 hover:text-slate-200 transition-colors border border-slate-700"
          >
            Déconnexion
          </button>
        </div>
      {/if}
    </nav>

    <!-- Contenu principal -->
    <main class="flex-1 overflow-auto">
      {@render children()}
    </main>
  </div>
{/if}
