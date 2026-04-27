<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/auth.svelte.js';

  let email    = $state('');
  let password = $state('');
  let error    = $state('');
  let loading  = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error   = '';
    loading = true;
    try {
      await authStore.login(email, password);
      if (authStore.mustChangePassword) {
        goto('/change-password');
      } else {
        goto('/');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur de connexion';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Connexion — Circuit Fit TV</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <!-- Logo -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-sky-400 tracking-tight">Circuit Fit TV</h1>
      <p class="text-slate-400 text-sm mt-1">Console d'administration</p>
    </div>

    <!-- Carte -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
      <h2 class="text-lg font-semibold text-slate-100 mb-6">Connexion</h2>

      <form onsubmit={handleSubmit} class="space-y-4">
        <!-- Email -->
        <div>
          <label for="email" class="block text-sm font-medium text-slate-300 mb-1.5">
            Adresse courriel
          </label>
          <input
            id="email"
            type="email"
            bind:value={email}
            required
            autocomplete="email"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                   text-sm transition-shadow"
            placeholder="coach@exemple.com"
          />
        </div>

        <!-- Mot de passe -->
        <div>
          <label for="password" class="block text-sm font-medium text-slate-300 mb-1.5">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            bind:value={password}
            required
            autocomplete="current-password"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                   text-sm transition-shadow"
            placeholder="••••••••••••"
          />
        </div>

        <!-- Erreur -->
        {#if error}
          <div class="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        {/if}

        <!-- Bouton -->
        <button
          type="submit"
          disabled={loading}
          class="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500
                 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm mt-2"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  </div>
</div>
