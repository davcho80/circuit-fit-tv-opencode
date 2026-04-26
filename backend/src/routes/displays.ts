// ============================================================
// Routes REST — Displays (écrans Android TV)
// GET    /displays           liste
// POST   /displays           enregistrer un display
// GET    /displays/:id       détail
// PATCH  /displays/:id       modifier (role, stationNumber, name)
// DELETE /displays/:id       supprimer
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Display } from '@cfitv/shared';
import { prisma } from '../db.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined(obj: Record<string, unknown>): any {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

const DisplayPatch = Display.pick({
  name: true,
  role: true,
  stationNumber: true,
}).partial();

const DisplayRegister = z.object({
  name: z.string().min(1).max(50),
  deviceInfo: z
    .object({
      model: z.string().optional(),
      os: z.string().optional(),
      appVersion: z.string().optional(),
    })
    .optional(),
});

export async function displaysRoutes(app: FastifyInstance): Promise<void> {
  // GET /displays
  app.get('/displays', async () => {
    return prisma.display.findMany({ orderBy: { pairedAt: 'asc' } });
  });

  // GET /displays/:id
  app.get<{ Params: { id: string } }>('/displays/:id', async (req, reply) => {
    const display = await prisma.display.findUnique({ where: { id: req.params.id } });
    if (!display) return reply.code(404).send({ error: 'Display not found' });
    return display;
  });

  // POST /displays  (un display s'enregistre lui-même à la première connexion)
  app.post('/displays', async (req, reply) => {
    const body = DisplayRegister.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const display = await prisma.display.create({
      data: {
        name: body.data.name,
        deviceModel: body.data.deviceInfo?.model ?? null,
        deviceOs: body.data.deviceInfo?.os ?? null,
        appVersion: body.data.deviceInfo?.appVersion ?? null,
        pairedAt: new Date(),
      },
    });
    return reply.code(201).send(display);
  });

  // PATCH /displays/:id
  app.patch<{ Params: { id: string } }>('/displays/:id', async (req, reply) => {
    const exists = await prisma.display.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Display not found' });

    const body = DisplayPatch.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const updated = await prisma.display.update({ where: { id: req.params.id }, data: stripUndefined(body.data) });
    return updated;
  });

  // DELETE /displays/:id
  app.delete<{ Params: { id: string } }>('/displays/:id', async (req, reply) => {
    const exists = await prisma.display.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Display not found' });

    await prisma.display.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
}
