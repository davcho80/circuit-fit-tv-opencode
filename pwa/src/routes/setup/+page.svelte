<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/auth.svelte.js';

  let email           = $state('');
  let password        = $state('');
  let confirmPassword = $state('');
  let error           = $state('');
  let loading         = $state(false);
  const API_BASE: string = import.meta.env['VITE_API_URL'] ?? '/api';

  const rules = $derived({
    length:  password.length >= 8,
    upper:   /[A-Z]/.test(password),
    lower:   /[a-z]/.test(password),
    digit:   /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    match:   password === confirmPassword && confirmPassword.length > 0,
  });
  const valid = $derived(email.length > 0 && Object.values(rules).every(Boolean));

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!valid) return;
    error   = '';
    loading = true;
    try {
      const res = await fetch(`${API_BASE}/setup`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; user?: object; error?: string };
      if (!res.ok) {
        error = (data.error as string) ?? 'Erreur lors de la création du compte';
        return;
      }
      // Stocker le token et connecter directement
      localStorage.setItem('cfitv_token', data.token!);
      await authStore.hydrate();
      goto('/');
    } catch {
      error = 'Impossible de contacter le serveur';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Configuration initiale — Circuit Fit TV</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm">

    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-sky-400 tracking-tight">Circuit Fit TV</h1>
      <p class="text-slate-400 text-sm mt-1">Première configuration</p>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">

      <div class="mb-6 flex items-start gap-3 bg-sky-950/50 border border-sky-800 rounded-xl p-4">
        <span class="text-sky-400 text-lg mt-0.5 shrink-0">⚙️</span>
        <div>
          <p class="text-sky-300 text-sm font-medium">Aucun compte détecté</p>
          <p class="text-slate-400 text-xs mt-0.5 leading-relaxed">
            Créez votre premier compte administrateur pour accéder à la console.
          </p>
        </div>
      </div>

      <form onsubmit={handleSubmit} class="space-y-4">

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
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            placeholder="admin@votregym.com"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-slate-300 mb-1.5">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            bind:value={password}
            required
            autocomplete="new-password"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            placeholder="••••••••••••"
          />
          {#if password.length > 0}
            <ul class="mt-2 space-y-1 text-xs">
              <li class={rules.length  ? 'text-emerald-400' : 'text-slate-500'}>{rules.length  ? '✓' : '○'} Minimum 8 caractères</li>
              <li class={rules.upper   ? 'text-emerald-400' : 'text-slate-500'}>{rules.upper   ? '✓' : '○'} Au moins une majuscule</li>
              <li class={rules.lower   ? 'text-emerald-400' : 'text-slate-500'}>{rules.lower   ? '✓' : '○'} Au moins une minuscule</li>
              <li class={rules.digit   ? 'text-emerald-400' : 'text-slate-500'}>{rules.digit   ? '✓' : '○'} Au moins un chiffre</li>
              <li class={rules.special ? 'text-emerald-400' : 'text-slate-500'}>{rules.special ? '✓' : '○'} Au moins un caractère spécial</li>
            </ul>
          {/if}
        </div>

        <div>
          <label for="confirm" class="block text-sm font-medium text-slate-300 mb-1.5">
            Confirmer le mot de passe
          </label>
          <input
            id="confirm"
            type="password"
            bind:value={confirmPassword}
            required
            autocomplete="new-password"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm
                   {confirmPassword.length > 0 && !rules.match ? 'border-red-600' : ''}"
            placeholder="••••••••••••"
          />
          {#if confirmPassword.length > 0 && !rules.match}
            <p class="text-red-400 text-xs mt-1">Les mots de passe ne correspondent pas</p>
          {/if}
        </div>

        {#if error}
          <div class="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        {/if}

        <button
          type="submit"
          disabled={loading || !valid}
          class="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500
                 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm mt-2"
        >
          {loading ? 'Création…' : 'Créer le compte administrateur'}
        </button>

      </form>
    </div>
  </div>
</div>
