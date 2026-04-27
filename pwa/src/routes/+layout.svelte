<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/auth.svelte.js';
  import { t, setLocale, getLocale } from '$lib/i18n.svelte.js';
  import { studioSettings, loadSettings, applyBranding } from '$lib/settings.svelte.js';

  let { children } = $props();

  const isTv       = $derived($page.url.pathname.startsWith('/tv'));
  const isAuthPage = $derived(
    $page.url.pathname.startsWith('/login') ||
    $page.url.pathname.startsWith('/change-password') ||
    $page.url.pathname.startsWith('/setup'),
  );

  // Charger le branding au montage
  onMount(async () => {
    await loadSettings();
    applyBranding();
  });

  // Menu utilisateur
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

  const initials = $derived.by(() => {
    const email = authStore.user?.email ?? '';
    const local = email.split('@')[0] ?? '';
    const parts = local.split(/[._-]/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return local.slice(0, 2).toUpperCase();
  });

  const roleColor: Record<string, string> = {
    ADMIN: 'text-sky-400',
    COACH: 'text-emerald-400',
  };

  // Switcher de langue
  function toggleLocale() {
    setLocale(getLocale() === 'fr' ? 'en' : 'fr');
  }

  const nav = $derived([
    { href: '/exercises', label: t('nav.exercises'), icon: '🏋️' },
    { href: '/circuits',  label: t('nav.circuits'),  icon: '🔄' },
    { href: '/session',   label: t('nav.session'),   icon: '▶️' },
    { href: '/sessions',  label: t('nav.history'),   icon: '📋' },
    { href: '/stats',     label: t('nav.stats'),     icon: '📈' },
    { href: '/schedule',  label: t('nav.calendar'),  icon: '📅' },
    { href: '/screens',   label: t('nav.screens'),   icon: '📺' },
    { href: '/tv',          label: t('nav.tvStation'),  icon: '🖥️' },
    { href: '/tv/central',  label: t('nav.tvCentral'),  icon: '📊' },
    { href: '/tv/schedule', label: t('nav.tvSchedule'), icon: '📅' },
  ]);
</script>

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

    <nav class="bg-slate-900 border-b border-slate-800 flex items-center shrink-0">

      <!-- Zone liens scrollable -->
      <div class="flex items-center gap-1 px-4 py-2.5 overflow-x-auto flex-1 min-w-0">
        <a href="/" class="font-bold text-sky-400 text-lg tracking-tight px-2 mr-1 hover:text-sky-300 transition-colors shrink-0">
          {studioSettings.studioName}
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
            <span>{t('nav.users')}</span>
          </a>
          <a
            href="/settings"
            class="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md transition-colors shrink-0
              {$page.url.pathname.startsWith('/settings')
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}"
          >
            <span>⚙️</span>
            <span>{t('nav.settings')}</span>
          </a>
        {/if}
      </div>

      <!-- Zone droite fixe : langue + user menu -->
      <div class="flex items-center gap-1 px-3 py-2 shrink-0">

        <!-- Switcher langue -->
        <button
          onclick={toggleLocale}
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200
                 hover:bg-slate-800 transition-colors text-sm font-medium"
          title="Changer la langue / Switch language"
        >
          {getLocale() === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
        </button>

        <!-- Menu utilisateur -->
        {#if authStore.user}
          <div class="relative" data-user-menu>
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
                <p class="text-sm font-medium text-slate-200 leading-tight max-w-[120px] truncate">
                  {authStore.user.email.split('@')[0]}
                </p>
                <p class="text-xs leading-tight {roleColor[authStore.user.role] ?? 'text-slate-400'}">
                  {t(authStore.user.role === 'ADMIN' ? 'common.admin' : 'common.coach')}
                </p>
              </div>
              <svg class="w-3.5 h-3.5 text-slate-500 transition-transform {menuOpen ? 'rotate-180' : ''}"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {#if menuOpen}
              <div class="absolute right-0 top-full mt-1 w-64 bg-slate-900 border border-slate-700
                           rounded-xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
                <div class="px-4 py-3 border-b border-slate-800">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center
                                text-white text-sm font-bold shrink-0">{initials}</div>
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-slate-100 truncate">{authStore.user.email}</p>
                      <p class="text-xs {roleColor[authStore.user.role] ?? 'text-slate-400'} mt-0.5">
                        {t(authStore.user.role === 'ADMIN' ? 'common.admin' : 'common.coach')}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="py-1.5">
                  <button onclick={() => { closeMenu(); goto('/change-password'); }}
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300
                           hover:bg-slate-800 hover:text-slate-100 transition-colors text-left">
                    <span class="text-base">🔑</span>{t('user.changePassword')}
                  </button>
                  {#if authStore.isAdmin}
                    <button onclick={() => { closeMenu(); goto('/users'); }}
                      class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300
                             hover:bg-slate-800 hover:text-slate-100 transition-colors text-left">
                      <span class="text-base">👥</span>{t('user.manageUsers')}
                    </button>
                  {/if}
                  <div class="mx-3 my-1.5 border-t border-slate-800"></div>
                  <button onclick={handleSwitchUser}
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300
                           hover:bg-slate-800 hover:text-slate-100 transition-colors text-left">
                    <span class="text-base">🔄</span>{t('user.switchUser')}
                  </button>
                  <button onclick={handleLogout}
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400
                           hover:bg-red-950/40 hover:text-red-300 transition-colors text-left">
                    <span class="text-base">↩️</span>{t('user.logout')}
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </nav>

    <main class="flex-1 overflow-auto">
      {@render children()}
    </main>
  </div>
{/if}
