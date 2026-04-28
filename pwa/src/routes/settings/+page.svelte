<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/auth.svelte.js';
  import { settings as settingsApi, update as updateApi, type UpdateStatus } from '$lib/api.js';
  import { studioSettings, loadSettings, applyBranding } from '$lib/settings.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { onMount, onDestroy } from 'svelte';

  if (!authStore.isAdmin) goto('/');

  let studioName   = $state('');
  let primaryColor = $state('#0ea5e9');
  let logoFile     = $state<File | null>(null);
  let logoPreview  = $state<string | null>(null);
  let saving       = $state(false);
  let uploading    = $state(false);
  let uploadPct    = $state(0);
  let savedMsg     = $state(false);
  let error        = $state('');

  onMount(async () => {
    await loadSettings();
    studioName   = studioSettings.studioName;
    primaryColor = studioSettings.primaryColor;
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
    error   = '';
    saving  = true;
    try {
      await settingsApi.patch({ studioName, primaryColor });
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
      error = e instanceof Error ? e.message : 'Erreur';
    } finally {
      saving = false;
    }
  }

  async function removeLogo() {
    try {
      await settingsApi.patch({ logoUrl: null });
      await loadSettings();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Erreur';
    }
  }

  // Prévisualisation couleur en temps réel
  $effect(() => {
    document.documentElement.style.setProperty('--color-primary-preview', primaryColor);
  });

  // ---- Mise à jour ----

  type UpdatePhase = 'idle' | 'checking' | 'up-to-date' | 'available' | 'streaming' | 'restarting' | 'done' | 'error';

  let updatePhase   = $state<UpdatePhase>('idle');
  let updateInfo    = $state<UpdateStatus | null>(null);
  let updateLogs    = $state<string[]>([]);
  let updateError   = $state('');
  let restartSecs   = $state(0);

  let stopStream: (() => void) | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  onDestroy(() => {
    stopStream?.();
    if (pollInterval) clearInterval(pollInterval);
  });

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

    // Lancer le flux SSE de logs
    stopStream = updateApi.stream(
      (line) => { updateLogs = [...updateLogs, line]; },
      () => {
        // Le script est terminé → attendre que le serveur redémarre
        stopStream = null;
        beginRestartPolling();
      },
    );
  }

  function beginRestartPolling() {
    updatePhase = 'restarting';
    restartSecs = 0;
    const API_BASE: string = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';

    // Compter les secondes affichées
    const ticker = setInterval(() => { restartSecs++; }, 1000);

    // Attendre que /health réponde avec la nouvelle version
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok) {
          const data = await res.json() as { version: string };
          clearInterval(ticker);
          clearInterval(pollInterval!);
          pollInterval = null;
          updateInfo = { ...updateInfo!, currentVersion: data.version };
          updatePhase = 'done';
        }
      } catch { /* serveur pas encore dispo */ }
    }, 2000);
  }
</script>

<svelte:head>
  <title>{t('settings.title')} — {studioSettings.studioName}</title>
</svelte:head>

<div class="p-6 max-w-2xl mx-auto space-y-8">

  <div>
    <h1 class="text-2xl font-bold text-slate-100">{t('settings.title')}</h1>
    <p class="text-slate-400 text-sm mt-0.5">Branding affiché sur les écrans TV</p>
  </div>

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
        <!-- Prévisualisation -->
        <div class="flex items-center gap-2">
          <div class="h-8 px-4 rounded-lg text-white text-sm font-medium flex items-center"
               style="background-color: {primaryColor}">
            Aperçu
          </div>
        </div>
      </div>
      <p class="text-xs text-slate-500 mt-1.5">Couleur appliquée aux boutons et accents sur les écrans TV</p>
    </div>

    <!-- Logo -->
    <div>
      <label class="block text-sm font-medium text-slate-300 mb-2">
        {t('settings.logo')}
      </label>

      <!-- Logo actuel -->
      {#if studioSettings.logoUrl && !logoPreview}
        <div class="flex items-center gap-4 mb-3">
          <img src={studioSettings.logoUrl} alt="Logo" class="h-16 w-auto rounded-lg bg-slate-800 p-2 object-contain" />
          <button onclick={removeLogo} class="text-xs text-red-400 hover:text-red-300 transition-colors">
            Supprimer le logo
          </button>
        </div>
      {/if}

      <!-- Prévisualisation nouveau logo -->
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

    {#if error}
      <div class="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>
    {/if}

    <!-- Bouton -->
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

  <!-- ════ Mises à jour ════ -->
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
          Vérifier
        </button>
      {/if}
    </div>

    <!-- Version courante -->
    {#if updateInfo}
      <div class="flex items-center gap-3 text-sm">
        <div class="bg-slate-800 rounded-lg px-3 py-2 flex-1">
          <p class="text-xs text-slate-500 mb-0.5">Version actuelle</p>
          <p class="font-mono font-semibold text-slate-100">{updateInfo.currentVersion}</p>
        </div>
        <div class="text-slate-600 text-lg">→</div>
        <div class="rounded-lg px-3 py-2 flex-1
          {updateInfo.updateAvailable
            ? 'bg-emerald-900/40 border border-emerald-700/50'
            : 'bg-slate-800'}">
          <p class="text-xs text-slate-500 mb-0.5">Dernière version</p>
          <p class="font-mono font-semibold {updateInfo.updateAvailable ? 'text-emerald-300' : 'text-slate-100'}">
            {updateInfo.latestVersion ?? '—'}
          </p>
        </div>
      </div>
    {/if}

    <!-- États -------- -->

    {#if updatePhase === 'checking'}
      <div class="flex items-center gap-2 text-slate-400 text-sm">
        <span class="animate-spin">⟳</span> Vérification en cours…
      </div>

    {:else if updatePhase === 'up-to-date'}
      <div class="flex items-center gap-2 text-emerald-400 text-sm">
        <span>✓</span> Vous utilisez la dernière version.
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
            Mettre à jour vers {updateInfo?.latestVersion}
          </button>
        {:else}
          <div class="text-amber-400 text-xs bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
            ⚠️ Mise à jour automatique non configurée. Exécutez <code class="font-mono bg-slate-800 px-1 rounded">update.sh</code> sur le serveur.
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
          Redémarrage du serveur… ({restartSecs}s)
        </div>
      </div>

    {:else if updatePhase === 'done'}
      <div class="flex items-center gap-2 text-emerald-400 text-sm">
        <span>✅</span>
        Mise à jour vers <span class="font-mono font-semibold">{updateInfo?.currentVersion}</span> réussie !
        <button onclick={() => window.location.reload()}
                class="ml-auto text-xs text-sky-400 hover:text-sky-300 underline">
          Recharger
        </button>
      </div>

    {:else if updatePhase === 'error'}
      <div class="text-red-400 text-sm">{updateError}</div>
    {/if}

  </div>

  <!-- Prévisualisation TV -->
  <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
    <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">Aperçu écran TV</h2>
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
