<script lang="ts">
  import type { CircuitStationData } from '$lib/api';

  interface StationPos {
    id: string;
    x: number; // 0–1
    y: number; // 0–1
  }

  interface Props {
    stations: CircuitStationData[];
    onSave: (positions: Array<{ id: string; layoutX: number; layoutY: number }>) => Promise<void>;
  }

  let { stations, onSave }: Props = $props();

  // ---- Positions initiales ----
  function autoArrange(n: number): Array<{ x: number; y: number }> {
    const cols = n <= 2 ? 2 : n <= 4 ? 2 : n <= 6 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    return Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      // Serpentine: odd rows go right-to-left
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

  // ---- Drag ----
  let canvasEl = $state<HTMLDivElement | null>(null);
  let dragging = $state<number | null>(null);
  let dragOffset = $state({ x: 0, y: 0 });

  function onPointerDown(e: PointerEvent, idx: number) {
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

  function resetLayout() {
    const auto = autoArrange(sortedStations.length);
    positions = sortedStations.map((s, i) => ({ id: s.id, ...auto[i]! }));
  }

  // ---- Save ----
  let saving = $state(false);
  let saved  = $state(false);

  async function save() {
    saving = true;
    await onSave(positions.map(p => ({ id: p.id, layoutX: p.x, layoutY: p.y })));
    saving = false;
    saved = true;
    setTimeout(() => { saved = false; }, 2000);
  }
</script>

<div class="space-y-3">
  <p class="text-sm text-slate-400">
    Faites glisser les stations pour les positionner dans la salle. Le tracé relie les stations dans l'ordre du circuit.
  </p>

  <!-- Canvas -->
  <div
    bind:this={canvasEl}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={onPointerUp}
    class="relative w-full rounded-xl border border-slate-700 bg-slate-900 overflow-hidden
           select-none touch-none cursor-default"
    style="aspect-ratio: 16/9;"
  >
    <!-- Grille de fond -->
    <svg class="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      <defs>
        <pattern id="gymgrid" width="5%" height="5%" patternUnits="objectBoundingBox">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#334155" stroke-width="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#gymgrid)" />
      <!-- Bords salle -->
      <rect x="2%" y="3%" width="96%" height="94%"
            fill="none" stroke="#475569" stroke-width="1.5" stroke-dasharray="8 4" rx="4"/>
    </svg>

    <!-- Lignes de connexion -->
    <svg class="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      {#each positions as pos, i}
        {#if i < positions.length - 1}
          {@const next = positions[i + 1]!}
          <line
            x1="{pos.x * 100}%" y1="{pos.y * 100}%"
            x2="{next.x * 100}%" y2="{next.y * 100}%"
            stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 5" opacity="0.5"
          />
          <!-- Flèche directionnelle au milieu -->
          {@const mx = (pos.x + next.x) / 2 * 100}
          {@const my = (pos.y + next.y) / 2 * 100}
          {@const angle = Math.atan2(next.y - pos.y, next.x - pos.x) * 180 / Math.PI}
          <polygon
            points="-6,-4 6,0 -6,4"
            fill="#38bdf8"
            opacity="0.6"
            transform="translate({mx}% {my}%) rotate({angle})"
          />
        {/if}
      {/each}
    </svg>

    <!-- Stations -->
    {#each positions as pos, i}
      {@const station = sortedStations[i]!}
      {@const name = station.exercises[0]?.exercise.name ?? `Station ${i + 1}`}
      {@const isDragging = dragging === i}
      <div
        role="button"
        tabindex="0"
        onpointerdown={(e) => onPointerDown(e, i)}
        class="absolute flex flex-col items-center gap-1
               {isDragging ? 'cursor-grabbing z-20' : 'cursor-grab z-10'}
               transition-transform duration-75"
        style="left: {pos.x * 100}%; top: {pos.y * 100}%; transform: translate(-50%, -50%);"
      >
        <!-- Cercle numéroté -->
        <div class="w-10 h-10 rounded-full border-2 flex items-center justify-center
                    font-bold text-sm shadow-lg transition-all
                    {isDragging
                      ? 'bg-sky-400 border-white text-slate-900 scale-110'
                      : 'bg-sky-600 border-sky-400 text-white hover:scale-105'}"
        >
          {i + 1}
        </div>
        <!-- Label -->
        <div class="bg-slate-800/95 border border-slate-700 px-2 py-0.5 rounded text-xs
                    text-slate-200 whitespace-nowrap max-w-[120px] truncate shadow">
          {name}
        </div>
      </div>
    {/each}
  </div>

  <!-- Actions -->
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <button
      onclick={resetLayout}
      class="text-sm text-slate-400 hover:text-slate-200 transition-colors"
    >
      Réinitialiser le layout
    </button>
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
</div>
