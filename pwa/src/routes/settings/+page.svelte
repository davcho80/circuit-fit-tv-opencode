<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/auth.svelte.js';
  import { settings as settingsApi } from '$lib/api.js';
  import { studioSettings, loadSettings, applyBranding } from '$lib/settings.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { onMount } from 'svelte';

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
