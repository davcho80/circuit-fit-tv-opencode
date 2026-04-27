// ============================================================
// Routes Setup — premier démarrage
// GET  /setup/status  → { needsSetup: boolean }
// POST /setup         → crée le premier admin (erreur si déjà des users)
// Les deux routes sont exemptes d'auth (voir server.ts allowlist)
// ============================================================

import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { z } from 'zod';
import { PasswordPolicy } from '@cfitv/shared';
import { prisma } from '../db.js';

const SetupBody = z.object({
  email:    z.string().email(),
  password: PasswordPolicy,
});

export async function setupRoutes(app: FastifyInstance): Promise<void> {

  // GET /setup/status — vérifie si le setup est nécessaire
  app.get('/setup/status', async () => {
    const count = await prisma.user.count();
    return { needsSetup: count === 0 };
  });

  // POST /setup — crée le premier admin
  app.post('/setup', async (req, reply) => {
    const count = await prisma.user.count();
    if (count > 0) {
      return reply.code(403).send({ error: 'Le setup a déjà été effectué' });
    }

    const body = SetupBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const passwordHash = await argon2.hash(body.data.password);
    const user = await prisma.user.create({
      data: {
        email:              body.data.email,
        passwordHash,
        role:               'ADMIN',
        mustChangePassword: false,  // L'admin a choisi son mdp lui-même
      },
    });

    // Retourner un token directement — l'admin est connecté
    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return reply.code(201).send({
      token,
      user: {
        id:                 user.id,
        email:              user.email,
        role:               user.role,
        mustChangePassword: user.mustChangePassword,
        lastLoginAt:        null,
        createdAt:          user.createdAt.toISOString(),
      },
    });
  });
}
