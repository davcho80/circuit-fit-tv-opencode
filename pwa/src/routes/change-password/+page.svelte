<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth as authApi } from '$lib/api.js';
  import { authStore } from '$lib/auth.svelte.js';

  let currentPassword = $state('');
  let newPassword     = $state('');
  let confirmPassword = $state('');
  let error           = $state('');
  let loading         = $state(false);

  // Validation locale de la politique de mot de passe
  const rules = $derived({
    length:    newPassword.length >= 8,
    upper:     /[A-Z]/.test(newPassword),
    lower:     /[a-z]/.test(newPassword),
    digit:     /[0-9]/.test(newPassword),
    special:   /[^A-Za-z0-9]/.test(newPassword),
    match:     newPassword === confirmPassword && confirmPassword.length > 0,
  });
  const valid = $derived(Object.values(rules).every(Boolean));

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!valid) return;
    error   = '';
    loading = true;
    try {
      await authApi.changePassword(currentPassword, newPassword);
      // Recharger le user (mustChangePassword passe à false)
      await authStore.hydrate();
      goto('/');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Changer le mot de passe — Circuit Fit TV</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-sky-400 tracking-tight">Circuit Fit TV</h1>
      <p class="text-slate-400 text-sm mt-1">Changement de mot de passe obligatoire</p>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
      <div class="mb-5 bg-amber-950/50 border border-amber-700 text-amber-300 text-sm rounded-lg px-4 py-3">
        Votre mot de passe temporaire doit être changé avant de continuer.
      </div>

      <form onsubmit={handleSubmit} class="space-y-4">
        <div>
          <label for="current" class="block text-sm font-medium text-slate-300 mb-1.5">Mot de passe actuel</label>
          <input
            id="current"
            type="password"
            bind:value={currentPassword}
            required
            autocomplete="current-password"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition-shadow"
            placeholder="••••••••••••"
          />
        </div>

        <div>
          <label for="new" class="block text-sm font-medium text-slate-300 mb-1.5">Nouveau mot de passe</label>
          <input
            id="new"
            type="password"
            bind:value={newPassword}
            required
            autocomplete="new-password"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition-shadow"
            placeholder="••••••••••••"
          />
          <!-- Indicateurs de politique -->
          {#if newPassword.length > 0}
            <ul class="mt-2 space-y-1 text-xs">
              <li class={rules.length  ? 'text-emerald-400' : 'text-slate-500'}>
                {rules.length  ? '✓' : '○'} Minimum 8 caractères
              </li>
              <li class={rules.upper   ? 'text-emerald-400' : 'text-slate-500'}>
                {rules.upper   ? '✓' : '○'} Au moins une majuscule
              </li>
              <li class={rules.lower   ? 'text-emerald-400' : 'text-slate-500'}>
                {rules.lower   ? '✓' : '○'} Au moins une minuscule
              </li>
              <li class={rules.digit   ? 'text-emerald-400' : 'text-slate-500'}>
                {rules.digit   ? '✓' : '○'} Au moins un chiffre
              </li>
              <li class={rules.special ? 'text-emerald-400' : 'text-slate-500'}>
                {rules.special ? '✓' : '○'} Au moins un caractère spécial
              </li>
            </ul>
          {/if}
        </div>

        <div>
          <label for="confirm" class="block text-sm font-medium text-slate-300 mb-1.5">Confirmer le nouveau mot de passe</label>
          <input
            id="confirm"
            type="password"
            bind:value={confirmPassword}
            required
            autocomplete="new-password"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition-shadow
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
          {loading ? 'Enregistrement…' : 'Changer le mot de passe'}
        </button>
      </form>
    </div>
  </div>
</div>
