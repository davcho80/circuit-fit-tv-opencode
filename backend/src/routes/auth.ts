// ============================================================
// Routes Auth
// POST /auth/login            → { token, user }
// GET  /auth/me               → UserPublic
// POST /auth/change-password  → 204
// ============================================================

import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { LoginBody, ChangePasswordBody } from '@cfitv/shared';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/jwt.plugin.js';
import { auditLog, auditLogSafely } from '../audit.js';

function toPublic(u: { id: string; email: string; role: string; mustChangePassword: boolean; lastLoginAt: Date | null; createdAt: Date }) {
  return {
    id:                 u.id,
    email:              u.email,
    role:               u.role,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt:        u.lastLoginAt?.toISOString() ?? null,
    createdAt:          u.createdAt.toISOString(),
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // POST /auth/login
  app.post('/auth/login', async (req, reply) => {
    const body = LoginBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const user = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (!user) {
      auditLogSafely(app.log, req, {
        action:   'auth.login.failed',
        metadata: { email: body.data.email, reason: 'unknown_user' },
      });
      return reply.code(401).send({ error: 'Email ou mot de passe incorrect' });
    }

    const valid = await argon2.verify(user.passwordHash, body.data.password);
    if (!valid) {
      auditLogSafely(app.log, req, {
        action:     'auth.login.failed',
        targetType: 'user',
        targetId:   user.id,
        metadata:   { email: user.email, reason: 'invalid_password' },
      });
      return reply.code(401).send({ error: 'Email ou mot de passe incorrect' });
    }

    // Mise à jour lastLoginAt
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = app.jwt.sign({
      sub:   user.id,
      email: user.email,
      role:  user.role,
    });

    await auditLog(req, {
      action:     'auth.login.succeeded',
      actor:      { sub: user.id, email: user.email, role: user.role },
      targetType: 'user',
      targetId:   user.id,
    });

    return reply.code(200).send({ token, user: toPublic(user) });
  });

  // GET /auth/me
  app.get('/auth/me', { preHandler: [requireAuth] }, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    return toPublic(user);
  });

  // POST /auth/change-password
  app.post('/auth/change-password', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = ChangePasswordBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    const valid = await argon2.verify(user.passwordHash, body.data.currentPassword);
    if (!valid) return reply.code(400).send({ error: 'Mot de passe actuel incorrect' });

    const passwordHash = await argon2.hash(body.data.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data:  { passwordHash, mustChangePassword: false },
    });

    await auditLog(req, {
      action:     'auth.password.changed',
      targetType: 'user',
      targetId:   user.id,
    });

    return reply.code(204).send();
  });
}
