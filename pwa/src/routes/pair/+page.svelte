<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/auth.svelte.js';

  const pin     = $page.url.searchParams.get('pin') ?? '';
  const adminUrl = `/admin?tab=screens&pin=${pin}`;

  onMount(() => {
    // Si déjà connecté, aller directement à la console
    if (authStore.token) {
      goto(adminUrl);
    }
  });
</script>

<svelte:head>
  <title>Jumelage TV — Circuit Fit TV</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm text-center">
    <!-- Icône -->
    <div class="w-16 h-16 bg-sky-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
      <svg class="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    </div>

    <h1 class="text-2xl font-bold text-slate-100 mb-2">TV prête à être configurée</h1>
    <p class="text-slate-400 text-sm mb-2">
      Code PIN : <span class="font-mono text-sky-400 text-base tracking-widest">{pin || '—'}</span>
    </p>
    <p class="text-slate-500 text-sm mb-8">
      Connectez-vous à la console pour associer cette TV à une station.
    </p>

    <a
      href="/login?redirect={encodeURIComponent(adminUrl)}"
      class="inline-block w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold
             py-3 px-6 rounded-xl transition-colors text-sm"
    >
      Ouvrir la console
    </a>
  </div>
</div>
