import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth/jwt.plugin.js';

const AuditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function auditLogsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/audit-logs', { preHandler: [requireAdmin] }, async (req, reply) => {
    const query = AuditQuery.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() });

    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take:    query.data.limit ?? 50,
    });
  });
}
