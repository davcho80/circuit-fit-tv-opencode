// ============================================================
// Routes REST — Circuits
// GET    /circuits           liste
// POST   /circuits           créer avec stations
// GET    /circuits/:id       détail (stations + exercices)
// PATCH  /circuits/:id       modifier le circuit
// DELETE /circuits/:id       supprimer (cascade stations)
// ============================================================

import type { FastifyInstance } from 'fastify';
import { CircuitCreate } from '@cfitv/shared';
import { prisma } from '../db.js';

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
  app.post('/circuits', async (req, reply) => {
    const body = CircuitCreate.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { stations, ...circuitData } = body.data;

    const circuit = await prisma.circuit.create({
      data: {
        ...circuitData,
        stations: {
          create: stations.map((s) => ({
            position: s.position,
            exercises: {
              create: s.exerciseIds.map((exerciseId) => ({ exerciseId })),
            },
          })),
        },
      },
      include: circuitInclude,
    });

    return reply.code(201).send(circuit);
  });

  // PATCH /circuits/:id
  app.patch<{ Params: { id: string } }>('/circuits/:id', async (req, reply) => {
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

  // DELETE /circuits/:id
  app.delete<{ Params: { id: string } }>('/circuits/:id', async (req, reply) => {
    const exists = await prisma.circuit.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Circuit not found' });

    await prisma.circuit.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
}
