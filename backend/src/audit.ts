import type { FastifyBaseLogger, FastifyRequest } from 'fastify';
import { Prisma, type UserRole } from './generated/prisma/client.js';
import { prisma } from './db.js';
import type { JwtUser } from './auth/jwt.plugin.js';

export interface AuditInput {
  action: string;
  actor?: JwtUser | null;
  targetType?: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

function userAgent(req: FastifyRequest): string | undefined {
  const header = req.headers['user-agent'];
  return Array.isArray(header) ? header.join(' ') : header;
}

export async function auditLog(req: FastifyRequest, input: AuditInput): Promise<void> {
  const actor = input.actor ?? req.user;
  await prisma.auditLog.create({
    data: {
      action:     input.action,
      actorId:    actor?.sub ?? null,
      actorEmail: actor?.email ?? null,
      actorRole:  (actor?.role as UserRole | undefined) ?? null,
      targetType: input.targetType ?? null,
      targetId:   input.targetId ?? null,
      ip:         req.ip,
      userAgent:  userAgent(req) ?? null,
      metadata:   input.metadata ?? Prisma.JsonNull,
    },
  });
}

export function auditLogSafely(log: FastifyBaseLogger, req: FastifyRequest, input: AuditInput): void {
  auditLog(req, input).catch((err: unknown) => {
    log.warn({ err, action: input.action }, 'Audit log write failed');
  });
}
