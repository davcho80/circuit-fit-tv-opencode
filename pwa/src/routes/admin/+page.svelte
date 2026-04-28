<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { authStore } from '$lib/auth.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { studioSettings, loadSettings, applyBranding } from '$lib/settings.svelte.js';
  import {
    settings as settingsApi,
    update  as updateApi,
    displays as displaysApi,
    users   as usersApi,
    type UpdateStatus,
    type Display,
    type DisplayRole,
    type UserPublic,
  } from '$lib/api.js';

  if (!authStore.isAdmin) goto('/');

  let { data } = $props();

  // ── Tabs ──────────────────────────────────────────────────────────
  type Tab = 'studio' | 'screens' | 'tv' | 'users' | 'updates';
  let activeTab = $state<Tab>('studio');

  const tabs = [
    { key: 'studio'  as Tab, icon: '🎨', label: () => t('admin.tab.studio')  },
    { key: 'screens' as Tab, icon: '📺', label: () => t('admin.tab.screens') },
    { key: 'tv'      as Tab, icon: '🖥️', label: () => t('admin.tab.tv')      },
    { key: 'users'   as Tab, icon: '👥', label: () => t('admin.tab.users')   },
    { key: 'updates' as Tab, icon: '🔄', label: () => t('admin.tab.updates') },
  ];

  // ═══════════════════════════════════════════════════════════════════
  // TAB: STUDIO
  // ═══════════════════════════════════════════════════════════════════

  let studioName   = $state('');
  let primaryColor = $state('#0ea5e9');
  let timezone     = $state('America/Montreal');
  let logoFile     = $state<File | null>(null);
  let logoPreview  = $state<string | null>(null);
  let saving       = $state(false);
  let uploading    = $state(false);
  let uploadPct    = $state(0);
  let savedMsg     = $state(false);
  let studioError  = $state('');

  onMount(async () => {
    await loadSettings();
    studioName   = studioSettings.studioName;
    primaryColor = studioSettings.primaryColor;
    timezone     = studioSettings.timezone;
  });

  $effect(() => {
    document.documentElement.style.setProperty('--color-primary-preview', primaryColor);
  });

  function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    logoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => { logoPreview = ev.target?.result as string; };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    studioError = '';
    saving = true;
    try {
      await settingsApi.patch({ studioName, primaryColor, timezone });
      if (logoFile) {
        uploading = true;
        await settingsApi.uploadLogo(logoFile, (pct) => { uploadPct = pct; });
        uploading = false;
        logoFile  = null;
        logoPreview = null;
      }
      await loadSettings();
      applyBranding();
      savedMsg = true;
      setTimeout(() => { savedMsg = false; }, 2500);
    } catch (e) {
      studioError = e instanceof Error ? e.message : 'Erreur';
    } finally {
      saving = false;
    }
  }

  async function removeLogo() {
    try {
      await settingsApi.patch({ logoUrl: null });
      await loadSettings();
    } catch (e) {
      studioError = e instanceof Error ? e.message : 'Erreur';
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // TAB: SCREENS
  // ═══════════════════════════════════════════════════════════════════

  let displays    = $state<Display[]>(data.displays);
  let onlineIds   = $state<Set<string>>(data.onlineIds);

  // Pairing form
  let pin           = $state('');
  let screenType    = $state<'STATION' | 'CENTRAL'>('STATION');
  let label         = $state('Station 1');
  let stationNumber = $state(1);
  let isLandscape   = $state(true);
  let pairStatus    = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
  let pairError     = $state('');

  $effect(() => {
    if (screenType === 'CENTRAL') label = 'Central';
    else if (label === 'Central') label = `Station ${stationNumber}`;
  });
  $effect(() => {
    if (screenType === 'STATION') label = `Station ${stationNumber}`;
  });

  async function claim() {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      pairError = 'Le code doit être composé de 4 chiffres.';
      pairStatus = 'error';
      return;
    }
    pairStatus = 'loading';
    pairError  = '';
    try {
      const res = await fetch('/pair/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, label, stationNumber, screenType, isLandscape }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        pairError  = (d as { error?: string }).error ?? `Erreur ${res.status}`;
        pairStatus = 'error';
        return;
      }
      pairStatus = 'success';
      pin = '';
      await refreshScreens();
      setTimeout(() => { pairStatus = 'idle'; }, 4000);
    } catch {
      pairError  = 'Impossible de joindre le serveur.';
      pairStatus = 'error';
    }
  }

  async function refreshScreens() {
    const BASE: string = import.meta.env['VITE_API_URL'] ?? '';
    const [dl, or] = await Promise.all([
      displaysApi.list(),
      fetch(`${BASE}/displays/online`)
        .then((r) => r.json() as Promise<{ onlineIds: string[] }>)
        .catch(() => ({ onlineIds: [] })),
    ]);
    displays  = dl;
    onlineIds = new Set<string>(or.onlineIds);
  }

  const screenRefreshTimer = setInterval(() => void refreshScreens(), 20_000);

  // Edit display
  let editDisplay  = $state<Display | null>(null);
  let editName     = $state('');
  let editRole     = $state<DisplayRole>('UNASSIGNED');
  let editStation  = $state(1);
  let editSaving   = $state(false);
  let editError    = $state<string | null>(null);

  function openEdit(d: Display) {
    editDisplay = d;
    editName    = d.name;
    editRole    = d.role;
    editStation = d.stationNumber ?? 1;
    editError   = null;
  }

  async function saveEdit() {
    if (!editDisplay) return;
    editSaving = true;
    editError  = null;
    try {
      await displaysApi.update(editDisplay.id, {
        name:          editName.trim() || editDisplay.name,
        role:          editRole,
        stationNumber: editRole === 'STATION' ? editStation : null,
      });
      editDisplay = null;
      await refreshScreens();
    } catch (e) {
      editError = e instanceof Error ? e.message : 'Erreur inconnue';
    } finally {
      editSaving = false;
    }
  }

  let deleteDisplayId = $state<string | null>(null);

  async function confirmDeleteDisplay() {
    if (!deleteDisplayId) return;
    await displaysApi.delete(deleteDisplayId);
    deleteDisplayId = null;
    await refreshScreens();
  }

  const ROLE_LABEL: Record<DisplayRole, string> = {
    STATION:    'Station',
    CENTRAL:    'Central',
    UNASSIGNED: 'Non assigné',
  };
  const ROLE_ICON: Record<DisplayRole, string> = {
    STATION:    '🏋️',
    CENTRAL:    '📊',
    UNASSIGNED: '❓',
  };

  function isOnline(d: Display): boolean { return onlineIds.has(d.id); }

  function lastSeenLabel(iso: string | null): string {
    if (!iso) return 'Jamais vu';
    const diff = Date.now() - new Date(iso).getTime();
    const sec  = Math.floor(diff / 1000);
    if (sec < 60)    return 'Il y a quelques secondes';
    if (sec < 3600)  return `Il y a ${Math.floor(sec / 60)} min`;
    if (sec < 86400) return `Il y a ${Math.floor(sec / 3600)} h`;
    return `Il y a ${Math.floor(sec / 86400)} j`;
  }

  // ═══════════════════════════════════════════════════════════════════
  // TAB: USERS
  // ═══════════════════════════════════════════════════════════════════

  let userList   = $state<UserPublic[]>(data.users);
  let loadError  = $state('');
  let showModal  = $state(false);

  let newEmail    = $state('');
  let newPassword = $state('');
  let newRole     = $state<'ADMIN' | 'COACH'>('COACH');
  let createError = $state('');
  let creating    = $state(false);

  let resetTarget   = $state<UserPublic | null>(null);
  let resetPassword = $state('');
  let resetError    = $state('');
  let resetting     = $state(false);

  async function loadUsers() {
    try {
      userList = await usersApi.list();
    } catch (e) {
      loadError = e instanceof Error ? e.message : t('users.errorLoad');
    }
  }

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
    if (!pwValid(newPassword)) { createError = t('users.pwPolicy'); return; }
    creating = true;
    try {
      await usersApi.create({ email: newEmail, password: newPassword, role: newRole });
      showModal   = false;
      newEmail    = '';
      newPassword = '';
      newRole     = 'COACH';
      await loadUsers();
    } catch (e) {
      createError = e instanceof Error ? e.message : t('users.errorCreate');
    } finally {
      creating = false;
    }
  }

  async function handleDelete(u: UserPublic) {
    if (!confirm(`Supprimer ${u.email} ?`)) return;
    try { await usersApi.delete(u.id); await loadUsers(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Erreur'); }
  }

  async function handleRoleToggle(u: UserPublic) {
    const newRoleVal = u.role === 'ADMIN' ? 'COACH' : 'ADMIN';
    try { await usersApi.patch(u.id, { role: newRoleVal }); await loadUsers(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Erreur'); }
  }

  async function handleReset(e: SubmitEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    resetError = '';
    if (!pwValid(resetPassword)) { resetError = t('users.pwPolicy'); return; }
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

  // ═══════════════════════════════════════════════════════════════════
  // TAB: UPDATES
  // ═══════════════════════════════════════════════════════════════════

  type UpdatePhase = 'idle' | 'checking' | 'up-to-date' | 'available' | 'streaming' | 'restarting' | 'done' | 'error';

  let updatePhase = $state<UpdatePhase>('idle');
  let updateInfo  = $state<UpdateStatus | null>(null);
  let updateLogs  = $state<string[]>([]);
  let updateError = $state('');
  let restartSecs = $state(0);
  let stopStream: (() => void) | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  async function checkForUpdates() {
    updatePhase = 'checking';
    updateError = '';
    try {
      updateInfo  = await updateApi.status();
      updatePhase = updateInfo.updateAvailable ? 'available' : 'up-to-date';
    } catch (e) {
      updateError = e instanceof Error ? e.message : 'Erreur de vérification';
      updatePhase = 'error';
    }
  }

  async function startUpdate() {
    if (!updateInfo?.canUpdate) return;
    updateLogs  = [];
    updatePhase = 'streaming';
    stopStream = updateApi.stream(
      (line) => { updateLogs = [...updateLogs, line]; },
      () => { stopStream = null; beginRestartPolling(); },
    );
  }

  function beginRestartPolling() {
    updatePhase = 'restarting';
    restartSecs = 0;
    const API_BASE: string = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';
    const ticker = setInterval(() => { restartSecs++; }, 1000);
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok) {
          const d = await res.json() as { version: string };
          clearInterval(ticker);
          clearInterval(pollInterval!);
          pollInterval = null;
          updateInfo   = { ...updateInfo!, currentVersion: d.version };
          updatePhase  = 'done';
        }
      } catch { /* server restarting */ }
    }, 2000);
  }

  onDestroy(() => {
    clearInterval(screenRefreshTimer);
    stopStream?.();
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

<svelte:head>
  <title>{t('admin.title')} — {studioSettings.studioName}</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto space-y-6">

  <div>
    <h1 class="text-2xl font-bold text-slate-100">{t('admin.title')}</h1>
    <p class="text-slate-400 text-sm mt-0.5">Configuration et gestion de Circuit Fit TV</p>
  </div>

  <!-- Tab bar -->
  <div class="flex gap-1 border-b border-slate-800 overflow-x-auto">
    {#each tabs as tab}
      <button
        onclick={() => { activeTab = tab.key; }}
        class="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors shrink-0 border-b-2
          {activeTab === tab.key
            ? 'border-sky-500 text-sky-300'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}"
      >
        <span>{tab.icon}</span>
        <span>{tab.label()}</span>
      </button>
    {/each}
  </div>

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- TAB STUDIO                                                      -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {#if activeTab === 'studio'}
    <div class="space-y-6 max-w-2xl">

      <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">

        <!-- Nom du studio -->
        <div>
          <label for="studio-name" class="block text-sm font-medium text-slate-300 mb-1.5">
            {t('settings.studioName')}
          </label>
          <input
            id="studio-name"
            type="text"
            bind:value={studioName}
            maxlength="100"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            placeholder="Mon Gym"
          />
        </div>

        <!-- Fuseau horaire -->
        <div>
          <label for="tz" class="block text-sm font-medium text-slate-300 mb-1.5">
            {t('admin.timezone')}
          </label>
          <select
            id="tz"
            bind:value={timezone}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="America/Montreal">America/Montreal (EST/EDT)</option>
            <option value="America/Toronto">America/Toronto</option>
            <option value="America/Vancouver">America/Vancouver (PST/PDT)</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Chicago">America/Chicago</option>
            <option value="America/Denver">America/Denver</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="Europe/Paris">Europe/Paris</option>
            <option value="UTC">UTC</option>
          </select>
          <p class="text-xs text-slate-500 mt-1.5">Utilisé pour le calendrier et les horaires automatiques.</p>
        </div>

        <!-- Couleur principale -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">
            {t('settings.primaryColor')}
          </label>
          <div class="flex items-center gap-4">
            <input
              type="color"
              bind:value={primaryColor}
              class="w-12 h-10 rounded-lg border border-slate-700 bg-slate-800 cursor-pointer p-0.5"
            />
            <input
              type="text"
              bind:value={primaryColor}
              pattern="^#[0-9a-fA-F]{6}$"
              maxlength="7"
              class="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100
                     font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="#0ea5e9"
            />
            <div class="h-8 px-4 rounded-lg text-white text-sm font-medium flex items-center"
                 style="background-color: {primaryColor}">
              Aperçu
            </div>
          </div>
          <p class="text-xs text-slate-500 mt-1.5">Couleur appliquée aux boutons et accents sur les écrans TV.</p>
        </div>

        <!-- Logo -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">
            {t('settings.logo')}
          </label>

          {#if studioSettings.logoUrl && !logoPreview}
            <div class="flex items-center gap-4 mb-3">
              <img src={studioSettings.logoUrl} alt="Logo" class="h-16 w-auto rounded-lg bg-slate-800 p-2 object-contain" />
              <button onclick={removeLogo} class="text-xs text-red-400 hover:text-red-300 transition-colors">
                Supprimer le logo
              </button>
            </div>
          {/if}

          {#if logoPreview}
            <div class="flex items-center gap-4 mb-3">
              <img src={logoPreview} alt="Aperçu" class="h-16 w-auto rounded-lg bg-slate-800 p-2 object-contain" />
              <button onclick={() => { logoFile = null; logoPreview = null; }}
                class="text-xs text-slate-400 hover:text-slate-200 transition-colors">
                Annuler
              </button>
            </div>
          {/if}

          <label class="inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg bg-slate-800
                        hover:bg-slate-700 border border-slate-700 text-sm text-slate-300 transition-colors">
            <span>📁</span>
            <span>{t('settings.logoUpload')}</span>
            <input type="file" accept="image/*" onchange={handleFileChange} class="hidden" />
          </label>
          <p class="text-xs text-slate-500 mt-1.5">PNG, SVG ou JPEG recommandé. Fond transparent pour PNG/SVG.</p>

          {#if uploading}
            <div class="mt-2">
              <div class="h-1.5 bg-slate-800 rounded-full">
                <div class="h-1.5 bg-sky-500 rounded-full transition-all" style="width: {uploadPct}%"></div>
              </div>
              <p class="text-xs text-slate-500 mt-1">Téléversement… {uploadPct}%</p>
            </div>
          {/if}
        </div>

        {#if studioError}
          <div class="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">{studioError}</div>
        {/if}

        <div class="flex items-center gap-4 pt-2">
          <button
            onclick={handleSave}
            disabled={saving}
            class="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500
                   text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            {saving ? 'Enregistrement…' : t('settings.save')}
          </button>
          {#if savedMsg}
            <span class="text-emerald-400 text-sm flex items-center gap-1.5">
              <span>✓</span> {t('settings.saved')}
            </span>
          {/if}
        </div>
      </div>

      <!-- Prévisualisation TV -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 class="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Aperçu écran TV</h2>
        <div class="rounded-xl overflow-hidden border border-slate-700 aspect-video bg-slate-950 relative flex items-center justify-center">
          {#if studioSettings.logoUrl || logoPreview}
            <img
              src={logoPreview ?? studioSettings.logoUrl ?? ''}
              alt="Logo"
              class="absolute top-4 left-4 h-10 w-auto object-contain"
            />
          {/if}
          <div class="text-center">
            <p class="text-2xl font-bold" style="color: {primaryColor}">{studioName || studioSettings.studioName}</p>
            <p class="text-slate-400 text-sm mt-1">Écran TV</p>
          </div>
          <div class="absolute bottom-4 right-4 px-3 py-1.5 rounded-lg text-white text-xs font-bold"
               style="background-color: {primaryColor}">
            En cours
          </div>
        </div>
      </div>

    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- TAB SCREENS                                                     -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {#if activeTab === 'screens'}
    <div class="space-y-8 max-w-3xl">

      <!-- Liste des écrans -->
      <section>
        <h2 class="text-lg font-bold text-slate-100 mb-1">Écrans connectés</h2>
        <p class="text-slate-400 text-sm mb-5">Gérez les téléviseurs connectés à Circuit Fit TV.</p>

        {#if displays.length === 0}
          <div class="text-slate-500 text-sm py-10 text-center border border-slate-800 rounded-xl">
            Aucun écran connecté. Apairez votre première TV ci-dessous.
          </div>
        {:else}
          <div class="space-y-2">
            {#each displays as d (d.id)}
              <div class="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div class="text-2xl shrink-0">{ROLE_ICON[d.role]}</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-slate-100">{d.name}</span>
                    <span class="flex items-center gap-1 text-xs font-medium">
                      <span class="w-1.5 h-1.5 rounded-full {isOnline(d) ? 'bg-emerald-400' : 'bg-slate-600'}"></span>
                      <span class="{isOnline(d) ? 'text-emerald-400' : 'text-slate-500'}">{isOnline(d) ? 'En ligne' : 'Hors ligne'}</span>
                    </span>
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium
                      {d.role === 'STATION'    ? 'bg-sky-900/50 text-sky-300' :
                       d.role === 'CENTRAL'    ? 'bg-violet-900/50 text-violet-300' :
                                                 'bg-slate-800 text-slate-400'}">
                      {ROLE_LABEL[d.role]}{d.role === 'STATION' && d.stationNumber != null ? ` #${d.stationNumber}` : ''}
                    </span>
                  </div>
                  <div class="text-xs text-slate-500 mt-0.5 flex gap-3 flex-wrap">
                    {#if d.deviceModel}<span>{d.deviceModel}</span>{/if}
                    {#if d.deviceOs}<span>{d.deviceOs}</span>{/if}
                    {#if d.appVersion}<span>v{d.appVersion}</span>{/if}
                    <span>{lastSeenLabel(d.lastSeen)}</span>
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button onclick={() => openEdit(d)}
                    class="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Modifier">✏️</button>
                  <button onclick={() => { deleteDisplayId = d.id; }}
                    class="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Supprimer">🗑️</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <hr class="border-slate-800" />

      <!-- Formulaire appairage -->
      <section>
        <h2 class="text-lg font-bold text-slate-100 mb-1">Connecter un nouvel écran</h2>
        <p class="text-slate-400 mb-4 text-sm">
          Sur la TV, appuyez sur "Obtenir un code", scannez le QR ou entrez le code manuellement.
        </p>

        <div class="space-y-5 max-w-lg">

          <div class="space-y-1.5">
            <label for="pin" class="block text-sm font-medium text-slate-300">Code affiché sur la TV</label>
            <input
              id="pin"
              bind:value={pin}
              maxlength="4"
              inputmode="numeric"
              pattern="\d{4}"
              placeholder="0000"
              class="w-full rounded-xl px-5 py-4 text-slate-100 text-4xl font-black text-center tracking-[0.4em]
                     bg-slate-800 border border-slate-700 focus:border-sky-500 focus:outline-none transition-colors"
              onkeydown={(e) => { if (e.key === 'Enter') void claim(); }}
            />
          </div>

          <div class="space-y-1.5">
            <p class="text-sm font-medium text-slate-300">Type d'écran</p>
            <div class="grid grid-cols-2 gap-3">
              {#each [
                { value: 'STATION', icon: '🏋️', label: 'Station',  desc: "Exercices & timer" },
                { value: 'CENTRAL', icon: '📊', label: 'Central',  desc: "Vue d'ensemble"   },
              ] as opt}
                <button
                  onclick={() => { screenType = opt.value as 'STATION' | 'CENTRAL'; }}
                  class="flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl border-2 transition-all
                         {screenType === opt.value
                           ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                           : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}"
                >
                  <span class="text-2xl">{opt.icon}</span>
                  <span class="font-semibold text-sm">{opt.label}</span>
                  <span class="text-xs opacity-70">{opt.desc}</span>
                </button>
              {/each}
            </div>
          </div>

          <div class="space-y-4">
            <div class="space-y-1.5">
              <label for="screen-label" class="block text-sm font-medium text-slate-300">Nom de cet écran</label>
              <input
                id="screen-label"
                bind:value={label}
                class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                       text-slate-100 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            {#if screenType === 'STATION'}
              <div class="space-y-1.5">
                <p class="block text-sm font-medium text-slate-300">Numéro de station</p>
                <div class="flex items-center gap-3">
                  <button
                    onclick={() => { if (stationNumber > 1) stationNumber--; }}
                    class="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xl font-bold hover:bg-slate-700 transition-colors"
                  >−</button>
                  <span class="w-12 text-center text-2xl font-black text-sky-400">{stationNumber}</span>
                  <button
                    onclick={() => { if (stationNumber < 20) stationNumber++; }}
                    class="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xl font-bold hover:bg-slate-700 transition-colors"
                  >+</button>
                </div>
              </div>

              <div class="space-y-1.5">
                <p class="text-sm font-medium text-slate-300">Orientation</p>
                <div class="grid grid-cols-2 gap-3">
                  {#each [
                    { value: true,  icon: '▬', label: 'Paysage',  desc: 'TV horizontale' },
                    { value: false, icon: '▮', label: 'Portrait', desc: 'TV verticale'   },
                  ] as opt}
                    <button
                      onclick={() => { isLandscape = opt.value; }}
                      class="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-all
                             {isLandscape === opt.value
                               ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                               : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}"
                    >
                      <span class="text-xl">{opt.icon}</span>
                      <span class="font-semibold text-sm">{opt.label}</span>
                      <span class="text-xs opacity-70">{opt.desc}</span>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          {#if pairStatus === 'success'}
            <div class="py-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40
                        text-emerald-300 font-bold text-center text-lg">
              ✓ Écran configuré avec succès !
            </div>
          {:else}
            <button
              onclick={claim}
              disabled={pairStatus === 'loading' || pin.length !== 4}
              class="w-full py-4 rounded-xl font-bold text-lg transition-all
                     {pairStatus === 'loading' || pin.length !== 4
                       ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                       : 'bg-sky-500 hover:bg-sky-400 text-white'}"
            >
              {pairStatus === 'loading' ? 'Connexion…' : 'Connecter cet écran'}
            </button>
          {/if}

          {#if pairStatus === 'error'}
            <p class="text-red-400 text-sm text-center">{pairError}</p>
          {/if}
        </div>
      </section>
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- TAB TV PREVIEW                                                  -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {#if activeTab === 'tv'}
    <div class="space-y-4 max-w-2xl">
      <p class="text-slate-400 text-sm">{t('admin.tv.desc')}</p>

      <div class="grid gap-3">
        {#each [
          { href: '/tv',          icon: '🏋️', label: t('admin.tv.station'),  desc: 'Affichage station individuelle' },
          { href: '/tv/central',  icon: '📊', label: t('admin.tv.central'),  desc: 'Vue centrale de toutes les stations' },
          { href: '/tv/schedule', icon: '📅', label: t('admin.tv.schedule'), desc: 'Calendrier des séances TV' },
        ] as item}
          <a
            href={item.href}
            target="_blank"
            rel="noopener"
            class="flex items-center gap-4 bg-slate-900 border border-slate-800 hover:border-slate-700
                   rounded-xl px-5 py-4 transition-colors group"
          >
            <span class="text-3xl">{item.icon}</span>
            <div class="flex-1">
              <p class="font-semibold text-slate-100 group-hover:text-sky-300 transition-colors">{item.label}</p>
              <p class="text-sm text-slate-500">{item.desc}</p>
            </div>
            <span class="text-slate-600 group-hover:text-slate-400 transition-colors text-sm">↗</span>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- TAB USERS                                                       -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {#if activeTab === 'users'}
    <div class="space-y-6">

      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-slate-100">{t('users.title')}</h2>
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
                  <td class="px-5 py-3.5 text-slate-400">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : '—'}</td>
                  <td class="px-5 py-3.5">
                    {#if u.mustChangePassword}
                      <span class="text-xs text-amber-400 font-medium">{t('users.tempPw')}</span>
                    {:else}
                      <span class="text-xs text-emerald-400">{t('users.active')}</span>
                    {/if}
                  </td>
                  <td class="px-5 py-3.5">
                    <div class="flex items-center gap-2 justify-end">
                      {#if u.id !== authStore.user?.id}
                        <button
                          onclick={() => handleRoleToggle(u)}
                          class="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                        >
                          {u.role === 'ADMIN' ? t('users.toCoach') : t('users.toAdmin')}
                        </button>
                      {/if}
                      <button
                        onclick={() => { resetTarget = u; resetPassword = ''; resetError = ''; }}
                        class="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                      >
                        {t('users.reset')}
                      </button>
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
  {/if}

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- TAB UPDATES                                                     -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {#if activeTab === 'updates'}
    <div class="max-w-2xl">
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">

        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-slate-100">Mises à jour</h2>
            <p class="text-slate-500 text-xs mt-0.5">Circuit Fit TV</p>
          </div>
          {#if updatePhase === 'idle' || updatePhase === 'up-to-date' || updatePhase === 'error'}
            <button
              onclick={checkForUpdates}
              class="text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg
                     border border-slate-700 transition-colors"
            >
              {t('admin.update.check')}
            </button>
          {/if}
        </div>

        {#if updateInfo}
          <div class="flex items-center gap-3 text-sm">
            <div class="bg-slate-800 rounded-lg px-3 py-2 flex-1">
              <p class="text-xs text-slate-500 mb-0.5">{t('admin.update.current')}</p>
              <p class="font-mono font-semibold text-slate-100">{updateInfo.currentVersion}</p>
            </div>
            <div class="text-slate-600 text-lg">→</div>
            <div class="rounded-lg px-3 py-2 flex-1
              {updateInfo.updateAvailable
                ? 'bg-emerald-900/40 border border-emerald-700/50'
                : 'bg-slate-800'}">
              <p class="text-xs text-slate-500 mb-0.5">{t('admin.update.latest')}</p>
              <p class="font-mono font-semibold {updateInfo.updateAvailable ? 'text-emerald-300' : 'text-slate-100'}">
                {updateInfo.latestVersion ?? '—'}
              </p>
            </div>
          </div>
        {/if}

        {#if updatePhase === 'checking'}
          <div class="flex items-center gap-2 text-slate-400 text-sm">
            <span class="animate-spin">⟳</span> {t('admin.update.checking')}
          </div>

        {:else if updatePhase === 'up-to-date'}
          <div class="flex items-center gap-2 text-emerald-400 text-sm">
            <span>✓</span> {t('admin.update.upToDate')}
          </div>

        {:else if updatePhase === 'available'}
          <div class="space-y-3">
            {#if updateInfo?.changelog}
              <div class="bg-slate-800/60 rounded-lg p-3 text-xs text-slate-400 max-h-28 overflow-y-auto whitespace-pre-wrap border border-slate-700/50">
                {updateInfo.changelog}
              </div>
            {/if}
            {#if updateInfo?.canUpdate}
              <button
                onclick={startUpdate}
                class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold
                       py-2.5 rounded-lg text-sm transition-colors"
              >
                {t('admin.update.install')} {updateInfo?.latestVersion}
              </button>
            {:else}
              <div class="text-amber-400 text-xs bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
                ⚠️ {t('admin.update.cannotUpdate')} Exécutez <code class="font-mono bg-slate-800 px-1 rounded">update.sh</code> sur le serveur.
              </div>
              {#if updateInfo?.releaseUrl}
                <a href={updateInfo.releaseUrl} target="_blank" rel="noopener"
                   class="text-xs text-sky-400 hover:text-sky-300 transition-colors">
                  Voir les notes de version →
                </a>
              {/if}
            {/if}
          </div>

        {:else if updatePhase === 'streaming'}
          <div class="space-y-2">
            <p class="text-sm text-amber-300 flex items-center gap-2">
              <span class="animate-pulse">●</span> Mise à jour en cours — ne pas fermer cette page
            </p>
            <div class="bg-slate-950 rounded-lg p-3 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto space-y-0.5 border border-slate-800">
              {#each updateLogs as line}
                <div class="{line.startsWith('✅') ? 'text-emerald-400' : line.startsWith('❌') ? 'text-red-400' : 'text-slate-400'}">{line}</div>
              {/each}
              {#if updateLogs.length === 0}
                <div class="text-slate-600 animate-pulse">En attente des logs…</div>
              {/if}
            </div>
          </div>

        {:else if updatePhase === 'restarting'}
          <div class="space-y-3">
            <div class="bg-slate-950 rounded-lg p-3 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto space-y-0.5 border border-slate-800">
              {#each updateLogs as line}
                <div class="{line.startsWith('✅') ? 'text-emerald-400' : line.startsWith('❌') ? 'text-red-400' : 'text-slate-400'}">{line}</div>
              {/each}
            </div>
            <div class="flex items-center gap-2 text-sky-400 text-sm">
              <span class="animate-spin">⟳</span>
              {t('admin.update.restarting')} ({restartSecs}s)
            </div>
          </div>

        {:else if updatePhase === 'done'}
          <div class="flex items-center gap-2 text-emerald-400 text-sm">
            <span>✅</span>
            {t('admin.update.done')} <span class="font-mono font-semibold">{updateInfo?.currentVersion}</span>
            <button onclick={() => window.location.reload()}
                    class="ml-auto text-xs text-sky-400 hover:text-sky-300 underline">
              Recharger
            </button>
          </div>

        {:else if updatePhase === 'error'}
          <div class="text-red-400 text-sm">{updateError}</div>
        {/if}

      </div>
    </div>
  {/if}

</div>

<!-- ══ Modal édition écran ══ -->
{#if editDisplay}
  <div
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4"
    role="presentation"
    onclick={(e) => { if (e.target === e.currentTarget) editDisplay = null; }}
  >
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
         role="dialog" aria-modal="true" aria-label="Modifier l'écran">
      <div class="px-6 pt-6 pb-4 border-b border-slate-800 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-100">Modifier l'écran</h2>
        <button onclick={() => { editDisplay = null; }} class="text-slate-400 hover:text-slate-100 text-xl leading-none">×</button>
      </div>
      <div class="px-6 py-5 space-y-5">
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1.5" for="edit-name">Nom</label>
          <input id="edit-name" bind:value={editName}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600" />
        </div>
        <div>
          <p class="text-sm font-medium text-slate-300 mb-2">Rôle</p>
          <div class="grid grid-cols-3 gap-2">
            {#each [
              { value: 'STATION',    icon: '🏋️', label: 'Station'     },
              { value: 'CENTRAL',    icon: '📊', label: 'Central'     },
              { value: 'UNASSIGNED', icon: '❓', label: 'Non assigné' },
            ] as opt}
              <button type="button" onclick={() => { editRole = opt.value as DisplayRole; }}
                class="flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-medium transition-all
                  {editRole === opt.value
                    ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}">
                <span class="text-lg">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            {/each}
          </div>
        </div>
        {#if editRole === 'STATION'}
          <div>
            <p class="text-sm font-medium text-slate-300 mb-2">Numéro de station</p>
            <div class="flex items-center gap-3">
              <button onclick={() => { if (editStation > 1) editStation--; }}
                class="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-lg font-bold hover:bg-slate-700 transition-colors">−</button>
              <span class="w-10 text-center text-xl font-black text-sky-400">{editStation}</span>
              <button onclick={() => { if (editStation < 20) editStation++; }}
                class="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-lg font-bold hover:bg-slate-700 transition-colors">+</button>
            </div>
          </div>
        {/if}
        {#if editError}
          <div class="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">{editError}</div>
        {/if}
      </div>
      <div class="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
        <button onclick={() => { editDisplay = null; }}
          class="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors">Annuler</button>
        <button onclick={saveEdit} disabled={editSaving}
          class="px-5 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg transition-colors">
          {editSaving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ══ Dialog suppression écran ══ -->
{#if deleteDisplayId}
  <div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
       role="presentation"
       onclick={(e) => { if (e.target === e.currentTarget) deleteDisplayId = null; }}>
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4">
      <div class="text-4xl">🗑️</div>
      <p class="text-slate-200 font-medium">Supprimer cet écran ?</p>
      <p class="text-slate-400 text-sm">L'écran devra être re-apairé pour se reconnecter.</p>
      <div class="flex gap-3 justify-center pt-2">
        <button onclick={() => { deleteDisplayId = null; }}
          class="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 bg-slate-800 rounded-lg transition-colors">Annuler</button>
        <button onclick={confirmDeleteDisplay}
          class="px-4 py-2 text-sm font-medium bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors">Supprimer</button>
      </div>
    </div>
  </div>
{/if}

<!-- ══ Modal création utilisateur ══ -->
{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
      <h2 class="text-lg font-semibold text-slate-100 mb-5">{t('users.new')}</h2>
      <form onsubmit={handleCreate} class="space-y-4">
        <div>
          <label for="new-email" class="block text-sm font-medium text-slate-300 mb-1.5">{t('users.col.email')}</label>
          <input id="new-email" type="email" bind:value={newEmail} required
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            placeholder="coach@gym.com" />
        </div>
        <div>
          <label for="new-role" class="block text-sm font-medium text-slate-300 mb-1.5">{t('common.role')}</label>
          <select id="new-role" bind:value={newRole}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm">
            <option value="COACH">Coach</option>
            <option value="ADMIN">Administrateur</option>
          </select>
        </div>
        <div>
          <label for="new-pw" class="block text-sm font-medium text-slate-300 mb-1.5">
            {t('users.initPwLabel')}
            <span class="text-slate-500 font-normal">{t('users.initPwHint')}</span>
          </label>
          <input id="new-pw" type="password" bind:value={newPassword} required autocomplete="new-password"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            placeholder="••••••••••••" />
          <p class="text-xs text-slate-500 mt-1.5">{t('users.pwHint')}</p>
        </div>
        {#if createError}
          <div class="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">{createError}</div>
        {/if}
        <div class="flex gap-3 pt-2">
          <button type="button" onclick={() => showModal = false}
            class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-lg text-sm transition-colors">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={creating}
            class="flex-1 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500
                   text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
            {creating ? t('users.creating') : t('common.create')}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ══ Modal reset mot de passe ══ -->
{#if resetTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
      <h2 class="text-lg font-semibold text-slate-100 mb-1">{t('users.resetTitle')}</h2>
      <p class="text-slate-400 text-sm mb-5">{resetTarget.email}</p>
      <form onsubmit={handleReset} class="space-y-4">
        <div>
          <label for="reset-pw" class="block text-sm font-medium text-slate-300 mb-1.5">{t('users.newTempPw')}</label>
          <input id="reset-pw" type="password" bind:value={resetPassword} required autocomplete="new-password"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            placeholder="••••••••••••" />
          <p class="text-xs text-slate-500 mt-1.5">{t('users.pwHint')}</p>
        </div>
        {#if resetError}
          <div class="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">{resetError}</div>
        {/if}
        <div class="flex gap-3 pt-2">
          <button type="button" onclick={() => { resetTarget = null; }}
            class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-lg text-sm transition-colors">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={resetting}
            class="flex-1 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500
                   text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
            {resetting ? t('users.saving') : t('users.reset')}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
