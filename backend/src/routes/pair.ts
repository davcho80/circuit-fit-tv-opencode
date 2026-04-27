// ============================================================
// Route REST : appairage TV via code PIN
// POST /pair/claim — l'admin soumet le PIN + la config complète
// Le backend pousse PAIR_CONFIG à la TV via WebSocket
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hub } from '../ws/hub.js';
import { claimPin } from '../ws/pair.js';

const PairClaimBody = z.object({
  pin:           z.string().length(4).regex(/^\d{4}$/),
  label:         z.string().min(1).max(50),
  stationNumber: z.number().int().min(1).max(20),
  screenType:    z.enum(['STATION', 'DASHBOARD']),
  isLandscape:   z.boolean(),
});

export async function pairRoutes(app: FastifyInstance): Promise<void> {
  app.post('/pair/claim', async (req, reply) => {
    const body = PairClaimBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() });
    }

    const client = claimPin(body.data.pin);
    if (!client) {
      return reply.code(404).send({ error: 'Code invalide ou expiré. Vérifiez que la TV affiche bien ce code.' });
    }

    hub.send(client, {
      type:          'PAIR_CONFIG',
      label:         body.data.label,
      stationNumber: body.data.stationNumber,
      screenType:    body.data.screenType,
      isLandscape:   body.data.isLandscape,
    });

    return { ok: true, clientId: client.id, label: client.label };
  });
}
