// ============================================================
// Plugin JWT — @fastify/jwt
// Enregistré via fastify-plugin pour briser l'encapsulation
// et rendre app.jwt disponible dans tous les plugins.
// ============================================================

import fp from 'fastify-plugin';
import jwtPlugin from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

// Payload JWT
export interface JwtUser {
  sub:   string;
  email: string;
  role:  'ADMIN' | 'COACH';
}

// Augmenter FastifyJWT pour typer req.user correctement
declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: JwtUser;
  }
}

export const jwtFastifyPlugin = fp(async (app: FastifyInstance) => {
  await app.register(jwtPlugin, {
    secret: config.jwtSecret,
    sign:   { expiresIn: config.jwtExpiresIn },
  });
});

// ---- Helpers de protection de route ----

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    await reply.code(401).send({ error: 'Non authentifié' });
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    await reply.code(401).send({ error: 'Non authentifié' });
    return;
  }
  if (req.user?.role !== 'ADMIN') {
    await reply.code(403).send({ error: 'Accès réservé aux administrateurs' });
  }
}
