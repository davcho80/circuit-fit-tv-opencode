// ============================================================
// Routes REST — Statistiques
// GET  /stats            tableau de bord agrégé
// GET  /stats/export.csv export CSV des sessions
// ============================================================

import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export async function statsRoutes(app: FastifyInstance): Promise<void> {

  // GET /stats — dashboard agrégé
  app.get('/stats', async () => {
    const now = new Date();
    const day7ago  = new Date(now.getTime() - 7  * 24 * 3600_000);
    const day30ago = new Date(now.getTime() - 30 * 24 * 3600_000);

    const [
      total,
      last7,
      last30,
      completed,
      completedWithDuration,
      topCircuits,
      byDay,
    ] = await Promise.all([
      // Total général
      prisma.session.count(),

      // 7 derniers jours
      prisma.session.count({ where: { startedAt: { gte: day7ago } } }),

      // 30 derniers jours
      prisma.session.count({ where: { startedAt: { gte: day30ago } } }),

      // Sessions terminées
      prisma.session.count({ where: { status: 'COMPLETED' } }),

      // Durée moyenne (sessions COMPLETED avec endedAt)
      prisma.session.findMany({
        where: { status: 'COMPLETED', endedAt: { not: null } },
        select: { startedAt: true, endedAt: true },
      }),

      // Top 5 circuits les plus utilisés
      prisma.session.groupBy({
        by: ['circuitId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),

      // Sessions par jour (30 derniers jours)
      prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT DATE_TRUNC('day', "startedAt") AS day, COUNT(*)::bigint AS count
        FROM "Session"
        WHERE "startedAt" >= ${day30ago}
        GROUP BY DATE_TRUNC('day', "startedAt")
        ORDER BY day ASC
      `,
    ]);

    // Durée moyenne en minutes
    let avgDurationMin = 0;
    if (completedWithDuration.length > 0) {
      const totalMs = completedWithDuration.reduce((acc, s) => {
        return acc + (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime());
      }, 0);
      avgDurationMin = Math.round(totalMs / completedWithDuration.length / 60_000);
    }

    // Résoudre les noms de circuits pour le top 5
    const circuitIds = topCircuits.map((r) => r.circuitId);
    const circuits = await prisma.circuit.findMany({
      where: { id: { in: circuitIds } },
      select: { id: true, name: true },
    });
    const circuitMap = new Map(circuits.map((c) => [c.id, c.name]));

    return {
      total,
      last7Days:      last7,
      last30Days:     last30,
      completed,
      aborted:        total - completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgDurationMin,
      topCircuits: topCircuits.map((r) => ({
        circuitId: r.circuitId,
        name:      circuitMap.get(r.circuitId) ?? 'Circuit supprimé',
        count:     r._count.id,
      })),
      byDay: byDay.map((r) => ({
        day:   r.day.toISOString().slice(0, 10),
        count: Number(r.count),
      })),
    };
  });

  // GET /stats/export.csv — export CSV
  app.get('/stats/export.csv', async (_req, reply) => {
    const sessions = await prisma.session.findMany({
      orderBy: { startedAt: 'desc' },
      take: 1000,
      include: { circuit: { select: { name: true } } },
    });

    const lines: string[] = [
      'Date,Heure,Circuit,Statut,Round,Durée (min)',
    ];

    for (const s of sessions) {
      const date  = new Date(s.startedAt).toLocaleDateString('fr-CA');
      const heure = new Date(s.startedAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
      const duree = s.endedAt
        ? String(Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60_000))
        : '';
      const statut = {
        COMPLETED: 'Terminée',
        ABORTED:   'Arrêtée',
        RUNNING:   'En cours',
        PAUSED:    'En pause',
      }[s.status] ?? s.status;

      lines.push([date, heure, `"${s.circuit.name}"`, statut, s.currentRound, duree].join(','));
    }

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="sessions.csv"')
      .send('\uFEFF' + lines.join('\r\n')); // BOM UTF-8 pour Excel
  });
}
