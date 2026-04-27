// ============================================================
// Routes REST — Circuits
// GET    /circuits           liste
// POST   /circuits           créer avec stations
// GET    /circuits/:id       détail (stations + exercices)
// PATCH  /circuits/:id       modifier le circuit
// DELETE /circuits/:id       supprimer (cascade stations)
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CircuitCreate } from '@cfitv/shared';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth/jwt.plugin.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined(obj: Record<string, unknown>): any {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

const circuitInclude = {
  stations: {
    orderBy: { position: 'asc' as const },
    include: {
      exercises: { include: { exercise: true } },
    },
  },
  scheduledBreaks: { orderBy: { afterRound: 'asc' as const } },
};

export async function circuitsRoutes(app: FastifyInstance): Promise<void> {
  // GET /circuits
  app.get('/circuits', async () => {
    return prisma.circuit.findMany({ include: circuitInclude, orderBy: { createdAt: 'desc' } });
  });

  // GET /circuits/:id
  app.get<{ Params: { id: string } }>('/circuits/:id', async (req, reply) => {
    const circuit = await prisma.circuit.findUnique({ where: { id: req.params.id }, include: circuitInclude });
    if (!circuit) return reply.code(404).send({ error: 'Circuit not found' });
    return circuit;
  });

  // POST /circuits
  app.post('/circuits', { preHandler: [requireAdmin] }, async (req, reply) => {
    const body = CircuitCreate.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { stations, scheduledBreaks, ...circuitData } = body.data;

    const circuit = await prisma.circuit.create({
      data: {
        ...circuitData,
        stations: {
          create: stations.map((s) => ({
            position: s.position,
            layoutX: s.layoutX ?? null,
            layoutY: s.layoutY ?? null,
            exercises: {
              create: s.exerciseIds.map((exerciseId) => ({ exerciseId })),
            },
          })),
        },
        ...(scheduledBreaks?.length && {
          scheduledBreaks: { create: scheduledBreaks.map((b) => ({ afterRound: b.afterRound, durationSec: b.durationSec, label: b.label ?? 'Pause eau' })) },
        }),
      },
      include: circuitInclude,
    });

    return reply.code(201).send(circuit);
  });

  // PATCH /circuits/:id
  app.patch<{ Params: { id: string } }>('/circuits/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const exists = await prisma.circuit.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Circuit not found' });

    // On ne permet que la modification des champs scalaires ici.
    // Pour modifier les stations, refaire un POST (remplacer le circuit).
    const allowed = CircuitCreate.omit({ stations: true }).partial();
    const body = allowed.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const updated = await prisma.circuit.update({
      where: { id: req.params.id },
      data: stripUndefined(body.data),
      include: circuitInclude,
    });
    return updated;
  });

  // PUT /circuits/:id/breaks — remplace toutes les pauses programmées du circuit
  app.put<{ Params: { id: string } }>('/circuits/:id/breaks', { preHandler: [requireAdmin] }, async (req, reply) => {
    const exists = await prisma.circuit.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Circuit not found' });

    const Body = z.object({
      breaks: z.array(z.object({
        afterRound:  z.number().int().min(1).max(10),
        durationSec: z.number().int().min(10).max(600),
        label:       z.string().max(50).optional(),
      })).max(9),
    });
    const body = Body.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    // Remplacer en transaction : supprimer + recréer
    await prisma.$transaction([
      prisma.scheduledBreak.deleteMany({ where: { circuitId: req.params.id } }),
      ...(body.data.breaks.length > 0
        ? [prisma.scheduledBreak.createMany({
            data: body.data.breaks.map((b) => ({
              circuitId: req.params.id,
              afterRound: b.afterRound,
              durationSec: b.durationSec,
              label: b.label ?? 'Pause eau',
            })),
          })]
        : []),
    ]);

    const circuit = await prisma.circuit.findUnique({ where: { id: req.params.id }, include: circuitInclude });
    return circuit;
  });

  // PUT /circuits/:id/stations — remplace toutes les stations du circuit
  app.put<{ Params: { id: string } }>('/circuits/:id/stations', { preHandler: [requireAdmin] }, async (req, reply) => {
    const exists = await prisma.circuit.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Circuit not found' });

    const StationsBody = z.object({
      stations: z.array(z.object({
        position:    z.number().int().min(1),
        exerciseIds: z.array(z.string().uuid()).min(1),
        layoutX:     z.number().nullable().optional(),
        layoutY:     z.number().nullable().optional(),
      })).min(2),
    });
    const body = StationsBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    // Supprimer toutes les stations existantes (cascade supprime les exercices liés)
    // puis recréer en transaction
    await prisma.$transaction(async (tx) => {
      await tx.circuitStation.deleteMany({ where: { circuitId: req.params.id } });
      for (const s of body.data.stations) {
        await tx.circuitStation.create({
          data: {
            circuitId: req.params.id,
            position:  s.position,
            layoutX:   s.layoutX ?? null,
            layoutY:   s.layoutY ?? null,
            exercises: {
              create: s.exerciseIds.map((exerciseId) => ({ exerciseId })),
            },
          },
        });
      }
    });

    const circuit = await prisma.circuit.findUnique({ where: { id: req.params.id }, include: circuitInclude });
    return circuit;
  });

  // PATCH /circuits/:id/layout — met à jour uniquement les positions x/y des stations
  app.patch<{ Params: { id: string } }>('/circuits/:id/layout', { preHandler: [requireAdmin] }, async (req, reply) => {
    const exists = await prisma.circuit.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Circuit not found' });

    const LayoutUpdate = z.object({
      stations: z.array(z.object({
        id: z.string().uuid(),
        layoutX: z.number().min(0).max(1),
        layoutY: z.number().min(0).max(1),
      })),
    });

    const body = LayoutUpdate.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    await Promise.all(
      body.data.stations.map((s) =>
        prisma.circuitStation.update({
          where: { id: s.id },
          data: { layoutX: s.layoutX, layoutY: s.layoutY },
        }),
      ),
    );

    const circuit = await prisma.circuit.findUnique({ where: { id: req.params.id }, include: circuitInclude });
    return circuit;
  });

  // DELETE /circuits/:id
  app.delete<{ Params: { id: string } }>('/circuits/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const exists = await prisma.circuit.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Circuit not found' });

    await prisma.circuit.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
}
