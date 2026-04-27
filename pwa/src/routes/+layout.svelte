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

  const isTv      = $derived($page.url.pathname.startsWith('/tv'));
  const isAuthPage = $derived(
    $page.url.pathname.startsWith('/login') ||
    $page.url.pathname.startsWith('/change-password') ||
    $page.url.pathname.startsWith('/setup'),
  );

  // Menu utilisateur déroulant
  let menuOpen = $state(false);

  function toggleMenu() { menuOpen = !menuOpen; }
  function closeMenu()  { menuOpen = false; }

  async function handleLogout() {
    closeMenu();
    await authStore.logout();
    goto('/login');
  }

  function handleSwitchUser() {
    closeMenu();
    authStore.logout();
    goto('/login');
  }

  // Initiales de l'email (ex: "AC" pour admin@cfitv.local)
  const initials = $derived.by(() => {
    const email = authStore.user?.email ?? '';
    const local = email.split('@')[0] ?? '';
    const parts = local.split(/[._-]/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return local.slice(0, 2).toUpperCase();
  });

  const roleLabel: Record<string, string> = { ADMIN: 'Admin', COACH: 'Coach' };
  const roleColor: Record<string, string> = {
    ADMIN: 'text-sky-400',
    COACH: 'text-emerald-400',
  };
</script>

<!-- Fermer le menu au clic extérieur -->
<svelte:window onclick={(e) => {
  if (menuOpen && !(e.target as Element)?.closest('[data-user-menu]')) closeMenu();
}} />

{#if isTv}
  {@render children()}
{:else if isAuthPage}
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
    {@render children()}
  </div>
{:else}
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">

    <!-- Nav : liens scrollables à gauche + menu user fixe à droite -->
    <nav class="bg-slate-900 border-b border-slate-800 flex items-center shrink-0">

      <!-- Zone liens — scrollable horizontalement -->
      <div class="flex items-center gap-1 px-4 py-2.5 overflow-x-auto flex-1 min-w-0">
        <a href="/" class="font-bold text-sky-400 text-lg tracking-tight px-2 mr-1 hover:text-sky-300 transition-colors shrink-0">
          Circuit Fit TV
        </a>

        {#each nav as item}
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
      </div>

      <!-- Zone utilisateur — fixe, pas de overflow -->
      {#if authStore.user}
        <div class="relative shrink-0 px-3 py-2" data-user-menu>
          <button
            onclick={toggleMenu}
            class="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl
                   hover:bg-slate-800 transition-colors group"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <div class="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center
                        text-white text-xs font-bold shrink-0 group-hover:bg-sky-500 transition-colors">
              {initials}
            </div>
            <div class="text-left hidden sm:block">
              <p class="text-sm font-medium text-slate-200 leading-tight max-w-[140px] truncate">
                {authStore.user.email.split('@')[0]}
              </p>
              <p class="text-xs leading-tight {roleColor[authStore.user.role] ?? 'text-slate-400'}">
                {roleLabel[authStore.user.role] ?? authStore.user.role}
              </p>
            </div>
            <svg
              class="w-3.5 h-3.5 text-slate-500 transition-transform {menuOpen ? 'rotate-180' : ''}"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {#if menuOpen}
            <div
              class="absolute right-0 top-full mt-1 w-64 bg-slate-900 border border-slate-700
                     rounded-xl shadow-2xl shadow-black/60 z-50 overflow-hidden"
            >
              <div class="px-4 py-3 border-b border-slate-800">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center
                              text-white text-sm font-bold shrink-0">
                    {initials}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-slate-100 truncate">{authStore.user.email}</p>
                    <p class="text-xs {roleColor[authStore.user.role] ?? 'text-slate-400'} mt-0.5">
                      {roleLabel[authStore.user.role] ?? authStore.user.role}
                    </p>
                  </div>
                </div>
              </div>

              <div class="py-1.5">
                <button
                  onclick={() => { closeMenu(); goto('/change-password'); }}
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300
                         hover:bg-slate-800 hover:text-slate-100 transition-colors text-left"
                >
                  <span class="text-base">🔑</span>
                  Changer le mot de passe
                </button>

                {#if authStore.isAdmin}
                  <button
                    onclick={() => { closeMenu(); goto('/users'); }}
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300
                           hover:bg-slate-800 hover:text-slate-100 transition-colors text-left"
                  >
                    <span class="text-base">👥</span>
                    Gérer les utilisateurs
                  </button>
                {/if}

                <div class="mx-3 my-1.5 border-t border-slate-800"></div>

                <button
                  onclick={handleSwitchUser}
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300
                         hover:bg-slate-800 hover:text-slate-100 transition-colors text-left"
                >
                  <span class="text-base">🔄</span>
                  Changer d'utilisateur
                </button>

                <button
                  onclick={handleLogout}
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400
                         hover:bg-red-950/40 hover:text-red-300 transition-colors text-left"
                >
                  <span class="text-base">↩️</span>
                  Déconnexion
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </nav>

    <main class="flex-1 overflow-auto">
      {@render children()}
    </main>
  </div>
{/if}
