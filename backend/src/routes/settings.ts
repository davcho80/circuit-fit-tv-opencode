// ============================================================
// Routes Settings — branding studio (singleton)
// GET   /settings         → public (TV screens en ont besoin)
// PATCH /settings         → admin seulement
// POST  /settings/logo    → admin seulement, upload logo
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth/jwt.plugin.js';
import { uploadLogoToS3 } from '../storage.js';

const SettingsPatch = z.object({
  studioName:   z.string().min(1).max(100).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Format #RRGGBB attendu').optional(),
  logoUrl:      z.string().url().nullable().optional(),
  timezone:     z.string().min(1).max(60).optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), 'Au moins un champ requis');

async function getOrCreate() {
  const existing = await prisma.studioSettings.findUnique({ where: { id: 'singleton' } });
  if (existing) return existing;
  return prisma.studioSettings.create({ data: { id: 'singleton' } });
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {

  // GET /settings — accessible sans auth (TV screens)
  app.get('/settings', async () => {
    return getOrCreate();
  });

  // PATCH /settings
  app.patch('/settings', { preHandler: [requireAdmin] }, async (req, reply) => {
    const body = SettingsPatch.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (body.data.studioName   !== undefined) data.studioName   = body.data.studioName;
    if (body.data.primaryColor !== undefined) data.primaryColor = body.data.primaryColor;
    if (body.data.logoUrl      !== undefined) data.logoUrl      = body.data.logoUrl;
    if (body.data.timezone     !== undefined) data.timezone     = body.data.timezone;

    const updated = await prisma.studioSettings.upsert({
      where:  { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });
    return updated;
  });

  // POST /settings/logo — upload logo vers S3
  app.post('/settings/logo', { preHandler: [requireAdmin] }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'Aucun fichier joint' });

    const mime = data.mimetype;
    if (!mime.startsWith('image/')) {
      return reply.code(415).send({ error: 'Le fichier doit être une image' });
    }

    try {
      const logoUrl = await uploadLogoToS3(data.file, mime);
      const updated = await prisma.studioSettings.upsert({
        where:  { id: 'singleton' },
        create: { id: 'singleton', logoUrl },
        update: { logoUrl },
      });
      return updated;
    } catch (err) {
      req.log.error({ err }, 'Logo upload failed');
      return reply.code(500).send({ error: 'Erreur lors du téléversement du logo' });
    }
  });
}
