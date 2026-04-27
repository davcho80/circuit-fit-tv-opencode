// ============================================================
// Routes REST — Sessions
// GET  /sessions         historique (liste)
// GET  /sessions/active  session en cours (depuis l'orchestrateur)
// GET  /sessions/:id     détail
// POST /sessions/start   démarrer (alias WS START pour HTTP)
// POST /sessions/pause
// POST /sessions/resume
// POST /sessions/skip
// POST /sessions/stop
// POST /sessions/adjust  { deltaMs: number }
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { orchestrator } from '../sessions/orchestrator.js';

export async function sessionsRoutes(app: FastifyInstance): Promise<void> {
  // GET /sessions
  app.get('/sessions', async () => {
    return prisma.session.findMany({
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: { circuit: { select: { name: true } } },
    });
  });

  // GET /sessions/active
  app.get('/sessions/active', () => {
    const state = orchestrator.getState();
    if (!state) return { active: false };

    const phase = state.phases[state.currentPhaseIdx];
    return {
      active: true,
      sessionId: state.sessionId,
      circuitId: state.circuitId,
      currentPhaseIdx: state.currentPhaseIdx,
      totalPhases: state.phases.length,
      phase,
      phaseStartsAt: state.phaseStartsAt,
      phaseEndsAt: state.phaseEndsAt,
      paused: state.pausedAt !== null,
    };
  });

  // GET /sessions/:id
  app.get<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    return session;
  });

  // POST /sessions/start
  app.post('/sessions/start', async (req, reply) => {
    const body = z.object({ circuitId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    try {
      const sessionId = await orchestrator.start(body.data.circuitId);
      return reply.code(201).send({ sessionId });
    } catch (err) {
      return reply.code(422).send({ error: String(err) });
    }
  });

  // POST /sessions/pause
  app.post('/sessions/pause', () => {
    orchestrator.pause();
    return { ok: true };
  });

  // POST /sessions/resume
  app.post('/sessions/resume', () => {
    orchestrator.resume();
    return { ok: true };
  });

  // POST /sessions/skip
  app.post('/sessions/skip', () => {
    orchestrator.skip();
    return { ok: true };
  });

  // POST /sessions/stop
  app.post('/sessions/stop', async () => {
    await orchestrator.stop();
    return { ok: true };
  });

  // POST /sessions/adjust
  app.post('/sessions/adjust', (req, reply) => {
    const body = z.object({ deltaMs: z.number().int() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    orchestrator.adjust(body.data.deltaMs);
    return { ok: true };
  });
}
