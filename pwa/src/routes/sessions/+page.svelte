<script lang="ts">
  import type { SessionHistory } from '$lib/api.js';

  let { data } = $props();

  const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    COMPLETED: { label: 'Terminée',  cls: 'bg-emerald-900/40 text-emerald-300' },
    RUNNING:   { label: 'En cours',  cls: 'bg-sky-900/40 text-sky-300' },
    PAUSED:    { label: 'En pause',  cls: 'bg-amber-900/40 text-amber-300' },
    ABORTED:   { label: 'Arrêtée',   cls: 'bg-slate-800 text-slate-400' },
  };

  function duration(s: SessionHistory): string {
    if (!s.endedAt) return '—';
    const ms = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
    const min = Math.floor(ms / 60_000);
    const sec = Math.floor((ms % 60_000) / 1000);
    return min > 0 ? `${min} min ${sec}s` : `${sec}s`;
  }

  function dateLabel(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-CA', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // Grouper par date
  const grouped = $derived.by(() => {
    const map = new Map<string, SessionHistory[]>();
    for (const s of data.sessions) {
      const day = new Date(s.startedAt).toLocaleDateString('fr-CA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    return [...map.entries()];
  });
</script>

<svelte:head>
  <title>Historique — Circuit Fit TV</title>
</svelte:head>

<div class="p-6 max-w-3xl mx-auto space-y-6">
  <div>
    <h1 class="text-2xl font-bold text-slate-100">Historique des sessions</h1>
    <p class="text-slate-400 text-sm mt-0.5">{data.sessions.length} session{data.sessions.length !== 1 ? 's' : ''} enregistrée{data.sessions.length !== 1 ? 's' : ''}</p>
  </div>

  {#if data.sessions.length === 0}
    <div class="text-slate-500 text-sm py-12 text-center border border-slate-800 rounded-xl">
      Aucune session enregistrée. Démarrez votre premier entraînement depuis la page Session.
    </div>
  {:else}
    {#each grouped as [day, items]}
      <section>
        <h2 class="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 capitalize">{day}</h2>
        <div class="space-y-2">
          {#each items as s (s.id)}
            {@const st = STATUS_LABEL[s.status] ?? { label: 'Arrêtée', cls: 'bg-slate-800 text-slate-400' }}
            <div class="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">

              <!-- Heure -->
              <div class="text-slate-400 text-sm tabular-nums shrink-0 w-12">
                {new Date(s.startedAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-slate-100 truncate">{s.circuit.name}</div>
                <div class="text-xs text-slate-500 mt-0.5">
                  Round {s.currentRound} · {duration(s)}
                </div>
              </div>

              <!-- Badge statut -->
              <span class="text-xs font-medium px-2.5 py-1 rounded-full shrink-0 {st.cls}">
                {st.label}
              </span>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>
