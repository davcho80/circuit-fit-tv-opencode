<script lang="ts">
  import { users as usersApi } from '$lib/api.js';
  import { authStore } from '$lib/auth.svelte.js';
  import type { UserPublic } from '$lib/api.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n.svelte.js';

  // Redirection si non-admin
  if (!authStore.isAdmin) goto('/');

  let userList   = $state<UserPublic[]>([]);
  let loadError  = $state('');
  let showModal  = $state(false);

  // Formulaire création
  let newEmail    = $state('');
  let newPassword = $state('');
  let newRole     = $state<'ADMIN' | 'COACH'>('COACH');
  let createError = $state('');
  let creating    = $state(false);

  // Reset mot de passe
  let resetTarget   = $state<UserPublic | null>(null);
  let resetPassword = $state('');
  let resetError    = $state('');
  let resetting     = $state(false);

  onMount(async () => {
    await loadUsers();
  });

  async function loadUsers() {
    try {
      userList = await usersApi.list();
    } catch (e) {
      loadError = e instanceof Error ? e.message : t('users.errorLoad');
    }
  }

  // Validation mot de passe
  function pwValid(pw: string): boolean {
    return (
      pw.length >= 8 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /[0-9]/.test(pw) &&
      /[^A-Za-z0-9]/.test(pw)
    );
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    createError = '';
    if (!pwValid(newPassword)) {
      createError = t('users.pwPolicy');
      return;
    }
    creating = true;
    try {
      await usersApi.create({ email: newEmail, password: newPassword, role: newRole });
      showModal  = false;
      newEmail   = '';
      newPassword = '';
      newRole    = 'COACH';
      await loadUsers();
    } catch (e) {
      createError = e instanceof Error ? e.message : t('users.errorCreate');
    } finally {
      creating = false;
    }
  }

  async function handleDelete(u: UserPublic) {
    if (!confirm(`Supprimer ${u.email} ?`)) return;
    try {
      await usersApi.delete(u.id);
      await loadUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function handleRoleToggle(u: UserPublic) {
    const newRoleVal = u.role === 'ADMIN' ? 'COACH' : 'ADMIN';
    try {
      await usersApi.patch(u.id, { role: newRoleVal });
      await loadUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function handleReset(e: SubmitEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    resetError = '';
    if (!pwValid(resetPassword)) {
      resetError = t('users.pwPolicy');
      return;
    }
    resetting = true;
    try {
      await usersApi.patch(resetTarget.id, { password: resetPassword });
      resetTarget   = null;
      resetPassword = '';
      await loadUsers();
    } catch (e) {
      resetError = e instanceof Error ? e.message : 'Erreur';
    } finally {
      resetting = false;
    }
  }

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-sky-500/20 text-sky-300 border-sky-700',
    COACH: 'bg-slate-700/50 text-slate-300 border-slate-600',
  };

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<svelte:head>
  <title>Utilisateurs — Circuit Fit TV</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto space-y-6">

  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-slate-100">{t('users.title')}</h1>
      <p class="text-slate-400 text-sm mt-0.5">{t('users.subtitle')}</p>
    </div>
    <button
      onclick={() => { showModal = true; createError = ''; }}
      class="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
    >
      + {t('users.new')}
    </button>
  </div>

  {#if loadError}
    <div class="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">{loadError}</div>
  {/if}

  <!-- Table -->
  <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
    {#if userList.length === 0}
      <p class="text-slate-500 text-sm p-6">{t('users.empty')}</p>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-800">
            <th class="text-left text-xs font-medium text-slate-500 uppercase tracking-widest px-5 py-3">{t('users.col.email')}</th>
            <th class="text-left text-xs font-medium text-slate-500 uppercase tracking-widest px-5 py-3">{t('users.col.role')}</th>
            <th class="text-left text-xs font-medium text-slate-500 uppercase tracking-widest px-5 py-3">{t('users.col.created')}</th>
            <th class="text-left text-xs font-medium text-slate-500 uppercase tracking-widest px-5 py-3">{t('users.col.lastLogin')}</th>
            <th class="text-left text-xs font-medium text-slate-500 uppercase tracking-widest px-5 py-3">{t('users.col.status')}</th>
            <th class="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800">
          {#each userList as u}
            <tr class="hover:bg-slate-800/50 transition-colors">
              <td class="px-5 py-3.5 text-slate-200 font-medium">{u.email}</td>
              <td class="px-5 py-3.5">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border {roleColors[u.role] ?? ''}">
                  {u.role}
                </span>
              </td>
              <td class="px-5 py-3.5 text-slate-400">{fmtDate(u.createdAt)}</td>
              <td class="px-5 py-3.5 text-slate-400">
                {u.lastLoginAt ? fmtDate(u.lastLoginAt) : '—'}
              </td>
              <td class="px-5 py-3.5">
                {#if u.mustChangePassword}
                  <span class="text-xs text-amber-400 font-medium">{t('users.tempPw')}</span>
                {:else}
                  <span class="text-xs text-emerald-400">{t('users.active')}</span>
                {/if}
              </td>
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-2 justify-end">
                  <!-- Changer rôle (sauf soi-même) -->
                  {#if u.id !== authStore.user?.id}
                    <button
                      onclick={() => handleRoleToggle(u)}
                      class="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                      title="Changer le rôle"
                    >
                      {u.role === 'ADMIN' ? t('users.toCoach') : t('users.toAdmin')}
                    </button>
                  {/if}
                  <!-- Reset mot de passe -->
                  <button
                    onclick={() => { resetTarget = u; resetPassword = ''; resetError = ''; }}
                    class="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                    title="Réinitialiser le mot de passe"
                  >
                    {t('users.reset')}
                  </button>
                  <!-- Supprimer (sauf soi-même) -->
                  {#if u.id !== authStore.user?.id}
                    <button
                      onclick={() => handleDelete(u)}
                      class="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-950/30 hover:bg-red-950/50 transition-colors"
                    >
                      {t('common.delete')}
                    </button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<!-- Modal création -->
{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
      <h2 class="text-lg font-semibold text-slate-100 mb-5">{t('users.new')}</h2>
      <form onsubmit={handleCreate} class="space-y-4">
        <div>
          <label for="new-email" class="block text-sm font-medium text-slate-300 mb-1.5">{t('users.col.email')}</label>
          <input
            id="new-email"
            type="email"
            bind:value={newEmail}
            required
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            placeholder="coach@gym.com"
          />
        </div>
        <div>
          <label for="new-role" class="block text-sm font-medium text-slate-300 mb-1.5">{t('common.role')}</label>
          <select
            id="new-role"
            bind:value={newRole}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          >
            <option value="COACH">Coach</option>
            <option value="ADMIN">Administrateur</option>
          </select>
        </div>
        <div>
          <label for="new-pw" class="block text-sm font-medium text-slate-300 mb-1.5">
            {t('users.initPwLabel')}
            <span class="text-slate-500 font-normal">{t('users.initPwHint')}</span>
          </label>
          <input
            id="new-pw"
            type="password"
            bind:value={newPassword}
            required
            autocomplete="new-password"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            placeholder="••••••••••••"
          />
          <p class="text-xs text-slate-500 mt-1.5">{t('users.pwHint')}</p>
        </div>

        {#if createError}
          <div class="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
            {createError}
          </div>
        {/if}

        <div class="flex gap-3 pt-2">
          <button
            type="button"
            onclick={() => showModal = false}
            class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={creating}
            class="flex-1 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500
                   text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {creating ? t('users.creating') : t('common.create')}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal reset mot de passe -->
{#if resetTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
      <h2 class="text-lg font-semibold text-slate-100 mb-1">{t('users.resetTitle')}</h2>
      <p class="text-slate-400 text-sm mb-5">{resetTarget.email}</p>
      <form onsubmit={handleReset} class="space-y-4">
        <div>
          <label for="reset-pw" class="block text-sm font-medium text-slate-300 mb-1.5">{t('users.newTempPw')}</label>
          <input
            id="reset-pw"
            type="password"
            bind:value={resetPassword}
            required
            autocomplete="new-password"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            placeholder="••••••••••••"
          />
          <p class="text-xs text-slate-500 mt-1.5">{t('users.pwHint')}</p>
        </div>

        {#if resetError}
          <div class="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
            {resetError}
          </div>
        {/if}

        <div class="flex gap-3 pt-2">
          <button
            type="button"
            onclick={() => { resetTarget = null; }}
            class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={resetting}
            class="flex-1 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500
                   text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {resetting ? t('users.saving') : t('users.reset')}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
