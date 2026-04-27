// ============================================================
// Routes REST — Schedules (calendrier récurrent)
// GET    /schedules           liste
// POST   /schedules           créer
// PATCH  /schedules/:id       modifier
// DELETE /schedules/:id       supprimer
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';

const ScheduleBody = z.object({
  circuitId:  z.string().uuid(),
  name:       z.string().min(1).max(100),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  timeHour:   z.number().int().min(0).max(23),
  timeMinute: z.number().int().min(0).max(59),
  timezone:   z.string().min(1).max(60).default('America/Montreal'),
  startDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu'),
  endDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isActive:   z.boolean().optional(),
});

const scheduleInclude = {
  circuit: { select: { name: true } },
} as const;

export async function schedulesRoutes(app: FastifyInstance): Promise<void> {

  // GET /schedules
  app.get('/schedules', async () => {
    return prisma.schedule.findMany({
      include:  scheduleInclude,
      orderBy: [{ isActive: 'desc' }, { startDate: 'asc' }],
    });
  });

  // POST /schedules
  app.post('/schedules', async (req, reply) => {
    const body = ScheduleBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { startDate, endDate, isActive, ...rest } = body.data;

    // Vérifie que le circuit existe
    const circuit = await prisma.circuit.findUnique({ where: { id: rest.circuitId } });
    if (!circuit) return reply.code(404).send({ error: 'Circuit introuvable' });

    // endDate doit être >= startDate
    if (endDate && endDate < startDate) {
      return reply.code(400).send({ error: 'endDate doit être >= startDate' });
    }

    const created = await prisma.schedule.create({
      data: {
        ...rest,
        isActive:  isActive ?? true,
        startDate: new Date(startDate + 'T12:00:00Z'),
        endDate:   endDate ? new Date(endDate + 'T12:00:00Z') : null,
      },
      include: scheduleInclude,
    });

    return reply.code(201).send(created);
  });

  // PATCH /schedules/:id
  app.patch<{ Params: { id: string } }>('/schedules/:id', async (req, reply) => {
    const exists = await prisma.schedule.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Schedule introuvable' });

    const body = ScheduleBody.partial().safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { startDate, endDate, circuitId, name, daysOfWeek, timeHour, timeMinute, timezone, isActive } = body.data;

    const updated = await prisma.schedule.update({
      where: { id: req.params.id },
      data:  {
        ...(circuitId  !== undefined && { circuitId }),
        ...(name       !== undefined && { name }),
        ...(daysOfWeek !== undefined && { daysOfWeek }),
        ...(timeHour   !== undefined && { timeHour }),
        ...(timeMinute !== undefined && { timeMinute }),
        ...(timezone   !== undefined && { timezone }),
        ...(isActive   !== undefined && { isActive }),
        ...(startDate  !== undefined && { startDate: new Date(startDate + 'T12:00:00Z') }),
        ...(endDate    !== undefined && { endDate: endDate ? new Date(endDate + 'T12:00:00Z') : null }),
      },
      include: scheduleInclude,
    });

    return updated;
  });

  // DELETE /schedules/:id
  app.delete<{ Params: { id: string } }>('/schedules/:id', async (req, reply) => {
    const exists = await prisma.schedule.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Schedule introuvable' });

    await prisma.schedule.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
}
