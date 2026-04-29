<script lang="ts">
  import type { CircuitStationData, LayoutLink } from '$lib/api';

  interface StationPos {
    id: string;
    x: number; // 0–1
    y: number; // 0–1
  }

  interface Props {
    stations:    CircuitStationData[];
    savedLinks:  LayoutLink[] | null;
    onSave: (
      positions: Array<{ id: string; layoutX: number; layoutY: number }>,
      links: Array<{ from: string; to: string }>,
    ) => Promise<void>;
  }

  let { stations, savedLinks, onSave }: Props = $props();

  // ---- Positions initiales ----
  function autoArrange(n: number): Array<{ x: number; y: number }> {
    const cols = n <= 2 ? 2 : n <= 4 ? 2 : n <= 6 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    return Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const xIdx = row % 2 === 0 ? col : (cols - 1 - col);
      return {
        x: 0.12 + xIdx * (0.76 / Math.max(1, cols - 1)),
        y: rows <= 1 ? 0.5 : 0.15 + row * (0.70 / Math.max(1, rows - 1)),
      };
    });
  }

  const sortedStations = $derived(
    [...stations].sort((a, b) => a.position - b.position)
  );

  let positions = $state<StationPos[]>(
    (() => {
      const auto = autoArrange(sortedStations.length);
      return sortedStations.map((s, i) => ({
        id: s.id,
        x: s.layoutX ?? auto[i]!.x,
        y: s.layoutY ?? auto[i]!.y,
      }));
    })()
  );

  // ---- Liens manuels ----
  let links = $state<Array<{ from: string; to: string }>>(
    savedLinks ?? []
  );

  // ---- Mode ----
  type Mode = 'move' | 'link';
  let mode = $state<Mode>('move');
  let linkStart = $state<string | null>(null); // stationId en cours de liaison

  // ---- Drag ----
  let canvasEl = $state<HTMLDivElement | null>(null);
  let dragging = $state<number | null>(null);
  let dragOffset = $state({ x: 0, y: 0 });

  function onPointerDown(e: PointerEvent, idx: number) {
    if (mode === 'link') return; // géré par onClick
    e.preventDefault();
    dragging = idx;
    const rect = canvasEl!.getBoundingClientRect();
    dragOffset = {
      x: e.clientX - rect.left - positions[idx]!.x * rect.width,
      y: e.clientY - rect.top  - positions[idx]!.y * rect.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (dragging === null || !canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    positions[dragging] = {
      ...positions[dragging]!,
      x: Math.min(0.97, Math.max(0.03, (e.clientX - rect.left - dragOffset.x) / rect.width)),
      y: Math.min(0.95, Math.max(0.05, (e.clientY - rect.top  - dragOffset.y) / rect.height)),
    };
  }

  function onPointerUp() { dragging = null; }

  // ---- Gestion des liens ----
  function onStationClick(stationId: string) {
    if (mode !== 'link') return;

    if (linkStart === null) {
      linkStart = stationId;
      return;
    }

    if (linkStart === stationId) {
      // Clic sur la même station = annuler
      linkStart = null;
      return;
    }

    // Vérifier si le lien existe déjà (dans les deux sens)
    const exists = links.some(
      (l) => (l.from === linkStart && l.to === stationId) ||
             (l.from === stationId && l.to === linkStart)
    );
    if (!exists) {
      links = [...links, { from: linkStart, to: stationId }];
    }
    linkStart = null;
  }

  function removeLink(from: string, to: string) {
    links = links.filter((l) => !(l.from === from && l.to === to));
  }

  // Trouver la position d'une station par son id
  function posOf(id: string) {
    return positions.find((p) => p.id === id) ?? { x: 0.5, y: 0.5 };
  }

  function resetLayout() {
    const auto = autoArrange(sortedStations.length);
    positions = sortedStations.map((s, i) => ({ id: s.id, ...auto[i]! }));
  }

  function clearLinks() {
    links = [];
    linkStart = null;
  }

  // ---- Save ----
  let saving = $state(false);
  let saved  = $state(false);

  async function save() {
    saving = true;
    await onSave(
      positions.map(p => ({ id: p.id, layoutX: p.x, layoutY: p.y })),
      links,
    );
    saving = false;
    saved = true;
    setTimeout(() => { saved = false; }, 2000);
  }
</script>

<div class="space-y-3">
  <!-- Barre d'outils mode -->
  <div class="flex items-center gap-2">
    <span class="text-sm text-slate-400 mr-1">Mode :</span>
    <button
      onclick={() => { mode = 'move'; linkStart = null; }}
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
             {mode === 'move'
               ? 'bg-sky-600 text-white'
               : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}"
    >
      Déplacer
    </button>
    <button
      onclick={() => { mode = 'link'; }}
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
             {mode === 'link'
               ? 'bg-violet-600 text-white'
               : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}"
    >
      Relier
    </button>
    {#if mode === 'link'}
      <span class="text-xs text-slate-500 ml-1">
        {#if linkStart}
          Cliquez sur une autre station pour créer le lien
        {:else}
          Cliquez sur une station de départ
        {/if}
      </span>
    {/if}
  </div>

  <!-- Canvas -->
  <div
    bind:this={canvasEl}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={onPointerUp}
    class="relative w-full rounded-xl border overflow-hidden select-none touch-none
           {mode === 'link' ? 'border-violet-700 bg-slate-900' : 'border-slate-700 bg-slate-900'}
           cursor-default"
    style="aspect-ratio: 16/9;"
  >
    <!-- Grille de fond -->
    <svg class="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      <defs>
        <pattern id="gymgrid" width="5%" height="5%" patternUnits="objectBoundingBox">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#334155" stroke-width="0.5"/>
        </pattern>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#38bdf8" opacity="0.7"/>
        </marker>
      </defs>
      <rect width="100%" height="100%" fill="url(#gymgrid)" />
      <rect x="2%" y="3%" width="96%" height="94%"
            fill="none" stroke="#475569" stroke-width="1.5" stroke-dasharray="8 4" rx="4"/>
    </svg>

    <!-- Liens manuels -->
    <svg class="absolute inset-0 w-full h-full" style="pointer-events: none;">
      {#each links as link}
        {@const a = posOf(link.from)}
        {@const b = posOf(link.to)}
        <!-- Zone de clic sur le lien (pointer-events auto sur cette ligne) -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <line
          x1="{a.x * 100}%" y1="{a.y * 100}%"
          x2="{b.x * 100}%" y2="{b.y * 100}%"
          stroke="transparent" stroke-width="16"
          style="pointer-events: stroke; cursor: pointer;"
          onclick={() => removeLink(link.from, link.to)}
        />
        <line
          x1="{a.x * 100}%" y1="{a.y * 100}%"
          x2="{b.x * 100}%" y2="{b.y * 100}%"
          stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 5" opacity="0.6"
          marker-end="url(#arrow)"
          style="pointer-events: none;"
        />
      {/each}
    </svg>

    <!-- Stations -->
    {#each positions as pos, i}
      {@const station = sortedStations[i]!}
      {@const name = station.exercises[0]?.exercise.name ?? `Station ${i + 1}`}
      {@const isDragging = dragging === i}
      {@const isLinkStart = linkStart === pos.id}
      <div
        role="button"
        tabindex="0"
        onpointerdown={(e) => onPointerDown(e, i)}
        onclick={() => onStationClick(pos.id)}
        onkeydown={(e) => e.key === 'Enter' && onStationClick(pos.id)}
        class="absolute flex flex-col items-center gap-1 transition-transform duration-75
               {mode === 'link' ? 'cursor-pointer' : isDragging ? 'cursor-grabbing z-20' : 'cursor-grab z-10'}"
        style="left: {pos.x * 100}%; top: {pos.y * 100}%; transform: translate(-50%, -50%); z-index: {isDragging ? 20 : 10};"
      >
        <div class="w-10 h-10 rounded-full border-2 flex items-center justify-center
                    font-bold text-sm shadow-lg transition-all
                    {isLinkStart
                      ? 'bg-violet-400 border-white text-slate-900 scale-110'
                      : isDragging
                        ? 'bg-sky-400 border-white text-slate-900 scale-110'
                        : mode === 'link'
                          ? 'bg-violet-700 border-violet-400 text-white hover:scale-105'
                          : 'bg-sky-600 border-sky-400 text-white hover:scale-105'}"
        >
          {i + 1}
        </div>
        <div class="bg-slate-800/95 border border-slate-700 px-2 py-0.5 rounded text-xs
                    text-slate-200 whitespace-nowrap max-w-[120px] truncate shadow">
          {name}
        </div>
      </div>
    {/each}
  </div>

  <!-- Actions -->
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <div class="flex gap-3">
      <button
        onclick={resetLayout}
        class="text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        Réinitialiser positions
      </button>
      {#if links.length > 0}
        <button
          onclick={clearLinks}
          class="text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          Effacer tous les liens
        </button>
      {/if}
    </div>
    <button
      onclick={save}
      disabled={saving}
      class="px-5 py-2 font-semibold rounded-lg transition-colors text-white
             {saved
               ? 'bg-emerald-600'
               : 'bg-sky-600 hover:bg-sky-500 disabled:opacity-50'}"
    >
      {saving ? 'Sauvegarde…' : saved ? '✓ Sauvegardé' : 'Sauvegarder le plan'}
    </button>
  </div>

  <p class="text-xs text-slate-500">
    Mode <strong class="text-slate-400">Déplacer</strong> : glissez les stations.
    Mode <strong class="text-slate-400">Relier</strong> : cliquez deux stations pour créer un lien, cliquez sur un lien existant pour le supprimer.
  </p>
</div>
