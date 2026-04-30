// ============================================================
// Route REST : appairage TV via code PIN
// GET  /pair/pending — liste les TVs en attente d'appairage
// POST /pair/claim   — l'admin soumet le PIN + la config complète
// Le backend pousse PAIR_CONFIG à la TV via WebSocket
// ============================================================

import type { FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { hub } from '../ws/hub.js';
import { claimPinWithInfo, getPendingPairs } from '../ws/pair.js';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/jwt.plugin.js';

const PairClaimBody = z.object({
  pin:           z.string().length(4).regex(/^\d{4}$/),
  label:         z.string().min(1).max(50),
  stationNumber: z.number().int().min(1).max(20),
  screenType:    z.enum(['STATION', 'DASHBOARD', 'CENTRAL', 'SCHEDULE']),
  isLandscape:   z.boolean(),
});

type PairScreenType = z.infer<typeof PairClaimBody>['screenType'];

function displayRoleFor(screenType: PairScreenType): 'STATION' | 'CENTRAL' | 'SCHEDULE' {
  if (screenType === 'STATION') return 'STATION';
  if (screenType === 'SCHEDULE') return 'SCHEDULE';
  return 'CENTRAL';
}

function createTvSecret(): string {
  return randomBytes(32).toString('base64url');
}

function hashTvSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export async function pairRoutes(app: FastifyInstance): Promise<void> {

  // GET /pair/pending — TVs en mode appairage (connectées WS + PIN enregistré)
  // Accessible aux utilisateurs authentifiés depuis la console
  app.get('/pair/pending', { preHandler: [requireAuth] }, async () => {
    return getPendingPairs();
  });

  // POST /pair/claim — l'admin valide le PIN et pousse la config à la TV
  app.post('/pair/claim', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = PairClaimBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() });
    }

    const entry = claimPinWithInfo(body.data.pin);
    if (!entry) {
      return reply.code(404).send({ error: 'Code invalide ou expiré. Vérifiez que la TV affiche bien ce code.' });
    }

    const { client, deviceModel, deviceOs, appVersion } = entry;

    // Créer l'enregistrement Display en DB
    const role = displayRoleFor(body.data.screenType);
    const tvSecret = createTvSecret();

    const display = await prisma.display.create({
      data: {
        name:          body.data.label,
        role,
        stationNumber: body.data.screenType === 'STATION' ? body.data.stationNumber : null,
        deviceModel:   deviceModel ?? null,
        deviceOs:      deviceOs    ?? null,
        appVersion:    appVersion  ?? null,
        tvSecretHash:  hashTvSecret(tvSecret),
        pairedAt:      new Date(),
        lastSeen:      new Date(),
      },
    });

    // Récupérer le branding studio pour l'envoyer à la TV
    const studio = await prisma.studioSettings.findUnique({ where: { id: 'singleton' } });

    hub.send(client, {
      type:          'PAIR_CONFIG',
      displayId:     display.id,
      label:         body.data.label,
      stationNumber: body.data.stationNumber,
      screenType:    body.data.screenType,
      isLandscape:   body.data.isLandscape,
      tvSecret,
      primaryColor:  studio?.primaryColor ?? '#0ea5e9',
      logoUrl:       studio?.logoUrl ?? null,
    });

    // Mettre à jour le displayId dans le hub pour que la TV soit visible immédiatement
    hub.setDisplayId(client.id, display.id);

    return { ok: true, clientId: client.id, label: client.label };
  });
}
