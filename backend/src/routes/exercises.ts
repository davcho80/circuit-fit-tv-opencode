// ============================================================
// Routes REST — Exercices
// GET    /exercises          liste paginée
// POST   /exercises          créer (metadata seulement)
// GET    /exercises/:id      détail
// PATCH  /exercises/:id      modifier
// DELETE /exercises/:id      supprimer
// POST   /exercises/:id/video  uploader la vidéo (multipart)
// ============================================================

import type { FastifyInstance } from 'fastify';
import { ExerciseCreate } from '@cfitv/shared';
import { prisma } from '../db.js';
import { processVideoUpload } from '../exercises/video.js';

// Retire les clés undefined et caste vers le type Prisma attendu.
// Nécessaire car Zod .partial() produit { key?: T | undefined } mais Prisma
// avec exactOptionalPropertyTypes n'accepte pas `undefined` dans les valeurs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined(obj: Record<string, unknown>): any {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export async function exercisesRoutes(app: FastifyInstance): Promise<void> {
  // GET /exercises
  app.get('/exercises', async (req) => {
    const { page = '1', limit = '20', difficulty } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);
    const where = difficulty ? { difficulty: difficulty as never } : {};

    const [items, total] = await Promise.all([
      prisma.exercise.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.exercise.count({ where }),
    ]);

    return { items, total, page: Number(page), limit: Number(limit) };
  });

  // GET /exercises/:id
  app.get<{ Params: { id: string } }>('/exercises/:id', async (req, reply) => {
    const exercise = await prisma.exercise.findUnique({ where: { id: req.params.id } });
    if (!exercise) return reply.code(404).send({ error: 'Exercise not found' });
    return exercise;
  });

  // POST /exercises
  app.post('/exercises', async (req, reply) => {
    const body = ExerciseCreate.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const exercise = await prisma.exercise.create({
      data: {
        ...body.data,
        videoUrl: '',
        thumbnailUrl: '',
        durationSec: 0,
      },
    });
    return reply.code(201).send(exercise);
  });

  // PATCH /exercises/:id
  app.patch<{ Params: { id: string } }>('/exercises/:id', async (req, reply) => {
    const exists = await prisma.exercise.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Exercise not found' });

    const body = ExerciseCreate.partial().safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const updated = await prisma.exercise.update({ where: { id: req.params.id }, data: stripUndefined(body.data) });
    return updated;
  });

  // DELETE /exercises/:id
  app.delete<{ Params: { id: string } }>('/exercises/:id', async (req, reply) => {
    const exists = await prisma.exercise.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Exercise not found' });

    await prisma.exercise.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });

  // POST /exercises/:id/video  — upload multipart → FFmpeg → MinIO
  app.post<{ Params: { id: string } }>('/exercises/:id/video', async (req, reply) => {
    const exists = await prisma.exercise.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'Exercise not found' });

    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'No file attached' });

    const mime = data.mimetype;
    if (!mime.startsWith('video/')) {
      return reply.code(415).send({ error: 'File must be a video' });
    }

    try {
      const result = await processVideoUpload(data.file, req.params.id);

      const updated = await prisma.exercise.update({
        where: { id: req.params.id },
        data: {
          videoUrl: result.videoUrl,
          thumbnailUrl: result.thumbnailUrl,
          durationSec: result.durationSec,
        },
      });
      return updated;
    } catch (err) {
      req.log.error({ err }, 'Video processing failed');
      return reply.code(500).send({ error: 'Video processing failed', detail: String(err) });
    }
  });
}
