// ============================================================
// Routes Users (admin seulement)
// GET    /users        → liste
// POST   /users        → créer
// PATCH  /users/:id   → modifier role / reset mot de passe
// DELETE /users/:id   → supprimer
// ============================================================

import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { UserCreate, UserPatch } from '@cfitv/shared';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth/jwt.plugin.js';

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

export async function usersRoutes(app: FastifyInstance): Promise<void> {

  // GET /users
  app.get('/users', { preHandler: [requireAdmin] }, async () => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map(toPublic);
  });

  // POST /users
  app.post('/users', { preHandler: [requireAdmin] }, async (req, reply) => {
    const body = UserCreate.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const existing = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (existing) return reply.code(409).send({ error: 'Un compte avec cet email existe déjà' });

    const passwordHash = await argon2.hash(body.data.password);
    const user = await prisma.user.create({
      data: {
        email:              body.data.email,
        passwordHash,
        role:               body.data.role,
        mustChangePassword: true,
      },
    });

    return reply.code(201).send(toPublic(user));
  });

  // PATCH /users/:id
  app.patch<{ Params: { id: string } }>('/users/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const body = UserPatch.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return reply.code(404).send({ error: 'Utilisateur introuvable' });

    // Protéger le dernier admin contre une rétrogradation
    if (body.data.role === 'COACH' && target.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) return reply.code(400).send({ error: 'Impossible de rétrograder le seul administrateur' });
    }

    const data: { role?: 'ADMIN' | 'COACH'; passwordHash?: string; mustChangePassword?: boolean } = {};
    if (body.data.role) data.role = body.data.role;
    if (body.data.password) {
      data.passwordHash       = await argon2.hash(body.data.password);
      data.mustChangePassword = true;
    }

    const updated = await prisma.user.update({ where: { id: req.params.id }, data });
    return toPublic(updated);
  });

  // DELETE /users/:id
  app.delete<{ Params: { id: string } }>('/users/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    // Empêcher auto-suppression
    if (req.params.id === req.user.sub) {
      return reply.code(400).send({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return reply.code(404).send({ error: 'Utilisateur introuvable' });

    // Protéger le dernier admin
    if (target.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) return reply.code(400).send({ error: 'Impossible de supprimer le seul administrateur' });
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
}
