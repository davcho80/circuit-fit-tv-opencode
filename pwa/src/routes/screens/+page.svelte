<script lang="ts">
  import { page } from '$app/stores';
  import { invalidateAll } from '$app/navigation';
  import { displays as api, type Display, type DisplayRole } from '$lib/api.js';

  let { data } = $props();

  // ════ Pairing form ════

  const pinFromUrl = $page.url.searchParams.get('pin') ?? '';

  let pin           = $state(pinFromUrl);
  let screenType    = $state<'STATION' | 'CENTRAL'>('STATION');
  let label         = $state('Station 1');
  let stationNumber = $state(1);
  let isLandscape   = $state(true);

  let pairStatus = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
  let pairError  = $state('');

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
      await invalidateAll();
      setTimeout(() => { pairStatus = 'idle'; }, 4000);
    } catch {
      pairError  = 'Impossible de joindre le serveur.';
      pairStatus = 'error';
    }
  }

  // ════ Edit display ════

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
      await api.update(editDisplay.id, {
        name:          editName.trim() || editDisplay.name,
        role:          editRole,
        stationNumber: editRole === 'STATION' ? editStation : null,
      });
      editDisplay = null;
      await invalidateAll();
    } catch (e) {
      editError = e instanceof Error ? e.message : 'Erreur inconnue';
    } finally {
      editSaving = false;
    }
  }

  // ════ Delete display ════

  let deleteId = $state<string | null>(null);

  async function confirmDelete() {
    if (!deleteId) return;
    await api.delete(deleteId);
    deleteId = null;
    await invalidateAll();
  }

  // ════ Helpers ════

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

  function lastSeenLabel(iso: string | null): string {
    if (!iso) return 'Jamais vu';
    const diff = Date.now() - new Date(iso).getTime();
    const sec  = Math.floor(diff / 1000);
    if (sec < 60)    return 'Il y a quelques secondes';
    if (sec < 3600)  return `Il y a ${Math.floor(sec / 60)} min`;
    if (sec < 86400) return `Il y a ${Math.floor(sec / 3600)} h`;
    return `Il y a ${Math.floor(sec / 86400)} j`;
  }
</script>

<svelte:head>
  <title>Écrans — Circuit Fit TV</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-6 py-10 space-y-10">

  <!-- ════ Liste des écrans ════ -->
  <section>
    <h1 class="text-2xl font-black text-slate-100 mb-1">Écrans</h1>
    <p class="text-slate-400 text-sm mb-5">Gérez les téléviseurs connectés à Circuit Fit TV.</p>

    {#if data.displays.length === 0}
      <div class="text-slate-500 text-sm py-10 text-center border border-slate-800 rounded-xl">
        Aucun écran connecté. Apairez votre première TV ci-dessous.
      </div>
    {:else}
      <div class="space-y-2">
        {#each data.displays as d (d.id)}
          <div class="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">

            <!-- Icône rôle -->
            <div class="text-2xl shrink-0">{ROLE_ICON[d.role]}</div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold text-slate-100">{d.name}</span>
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

            <!-- Actions -->
            <div class="flex items-center gap-1 shrink-0">
              <button
                onclick={() => openEdit(d)}
                class="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
                title="Modifier"
              >✏️</button>
              <button
                onclick={() => { deleteId = d.id; }}
                class="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Supprimer"
              >🗑️</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <hr class="border-slate-800" />

  <!-- ════ Formulaire appairage ════ -->
  <section>
    <h2 class="text-lg font-bold text-slate-100 mb-1">Connecter un nouvel écran</h2>
    {#if pinFromUrl}
      <div class="mb-4 flex items-center gap-2 text-emerald-400 text-sm font-medium">
        <span>✓</span>
        <span>Code détecté via QR — choisissez le type et confirmez.</span>
      </div>
    {:else}
      <p class="text-slate-400 mb-4 text-sm">
        Sur la TV, appuyez sur "Obtenir un code", scannez le QR ou entrez le code manuellement.
      </p>
    {/if}

    <div class="space-y-5 max-w-lg">

      <!-- Code PIN -->
      <div class="space-y-1.5">
        <label for="pin" class="block text-sm font-medium text-slate-300">Code affiché sur la TV</label>
        <input
          id="pin"
          bind:value={pin}
          maxlength="4"
          inputmode="numeric"
          pattern="\d{4}"
          placeholder="0000"
          readonly={!!pinFromUrl}
          class="w-full rounded-xl px-5 py-4 text-slate-100 text-4xl font-black text-center tracking-[0.4em]
                 focus:outline-none transition-colors
                 {pinFromUrl
                   ? 'bg-emerald-500/10 border-2 border-emerald-500/40 cursor-default'
                   : 'bg-slate-800 border border-slate-700 focus:border-sky-500'}"
          onkeydown={(e) => { if (e.key === 'Enter') claim(); }}
        />
      </div>

      <!-- Type -->
      <div class="space-y-1.5">
        <p class="text-sm font-medium text-slate-300">Type d'écran</p>
        <div class="grid grid-cols-2 gap-3">
          {#each [
            { value: 'STATION', icon: '🏋️', label: 'Station',  desc: 'Exercices & timer' },
            { value: 'CENTRAL', icon: '📊', label: 'Central',  desc: 'Vue d\'ensemble'   },
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

      <!-- Config -->
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

      <!-- Bouton -->
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

<!-- ════ Modal édition ════ -->
{#if editDisplay}
  <div
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4"
    role="presentation"
    onclick={(e) => { if (e.target === e.currentTarget) editDisplay = null; }}
  >
    <div
      class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Modifier l'écran"
    >
      <div class="px-6 pt-6 pb-4 border-b border-slate-800 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-100">Modifier l'écran</h2>
        <button onclick={() => { editDisplay = null; }} class="text-slate-400 hover:text-slate-100 text-xl leading-none">×</button>
      </div>

      <div class="px-6 py-5 space-y-5">

        <!-- Nom -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1.5" for="edit-name">Nom</label>
          <input
            id="edit-name"
            bind:value={editName}
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
        </div>

        <!-- Rôle -->
        <div>
          <p class="text-sm font-medium text-slate-300 mb-2">Rôle</p>
          <div class="grid grid-cols-3 gap-2">
            {#each [
              { value: 'STATION',    icon: '🏋️', label: 'Station'     },
              { value: 'CENTRAL',    icon: '📊', label: 'Central'     },
              { value: 'UNASSIGNED', icon: '❓', label: 'Non assigné' },
            ] as opt}
              <button
                type="button"
                onclick={() => { editRole = opt.value as DisplayRole; }}
                class="flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-medium transition-all
                  {editRole === opt.value
                    ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}"
              >
                <span class="text-lg">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Numéro de station (si STATION) -->
        {#if editRole === 'STATION'}
          <div>
            <p class="text-sm font-medium text-slate-300 mb-2">Numéro de station</p>
            <div class="flex items-center gap-3">
              <button
                onclick={() => { if (editStation > 1) editStation--; }}
                class="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-lg font-bold hover:bg-slate-700 transition-colors"
              >−</button>
              <span class="w-10 text-center text-xl font-black text-sky-400">{editStation}</span>
              <button
                onclick={() => { if (editStation < 20) editStation++; }}
                class="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-lg font-bold hover:bg-slate-700 transition-colors"
              >+</button>
            </div>
          </div>
        {/if}

        {#if editError}
          <div class="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">{editError}</div>
        {/if}
      </div>

      <div class="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
        <button
          onclick={() => { editDisplay = null; }}
          class="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors"
        >Annuler</button>
        <button
          onclick={saveEdit}
          disabled={editSaving}
          class="px-5 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {editSaving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ════ Dialog suppression ════ -->
{#if deleteId}
  <div
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    role="presentation"
    onclick={(e) => { if (e.target === e.currentTarget) deleteId = null; }}
  >
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4">
      <div class="text-4xl">🗑️</div>
      <p class="text-slate-200 font-medium">Supprimer cet écran ?</p>
      <p class="text-slate-400 text-sm">L'écran devra être re-apairé pour se reconnecter.</p>
      <div class="flex gap-3 justify-center pt-2">
        <button
          onclick={() => { deleteId = null; }}
          class="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 bg-slate-800 rounded-lg transition-colors"
        >Annuler</button>
        <button
          onclick={confirmDelete}
          class="px-4 py-2 text-sm font-medium bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
        >Supprimer</button>
      </div>
    </div>
  </div>
{/if}
