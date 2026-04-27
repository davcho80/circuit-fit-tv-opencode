// ============================================================
// Scheduler — vérifie toutes les 30 s si une session
// doit démarrer automatiquement selon les Schedule actifs.
// ============================================================

import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '../db.js';
import { orchestrator } from './orchestrator.js';
import { hub } from '../ws/hub.js';

// ---- Helpers timezone ----

interface LocalTime {
  dayOfWeek: number; // ISO 1=Lun … 7=Dim
  hour:      number;
  minute:    number;
  isoDate:   string; // YYYY-MM-DD
}

function nowInTimezone(tz: string): LocalTime {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone:  tz,
      year:      'numeric',
      month:     '2-digit',
      day:       '2-digit',
      hour:      '2-digit',
      minute:    '2-digit',
      weekday:   'long',
      hour12:    false,
    }).formatToParts(now);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

    const DAYS: Record<string, number> = {
      Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4,
      Friday: 5, Saturday: 6, Sunday: 7,
    };

    const rawHour = get('hour');
    const hour    = rawHour === '24' ? 0 : parseInt(rawHour, 10);

    return {
      dayOfWeek: DAYS[get('weekday')] ?? 1,
      hour,
      minute:  parseInt(get('minute'), 10),
      isoDate: `${get('year')}-${get('month')}-${get('day')}`,
    };
  } catch {
    // Fallback UTC
    const d = now.getUTCDay();
    return {
      dayOfWeek: d === 0 ? 7 : d,
      hour:      now.getUTCHours(),
      minute:    now.getUTCMinutes(),
      isoDate:   now.toISOString().slice(0, 10),
    };
  }
}

// ---- Cœur du scheduler ----

export function startScheduler(log: FastifyBaseLogger): () => void {
  let busy = false;

  async function tick(): Promise<void> {
    if (busy) return;
    busy = true;

    try {
      const schedules = await prisma.schedule.findMany({
        where: { isActive: true },
      });

      for (const sched of schedules) {
        const local = nowInTimezone(sched.timezone);

        // Bon jour de la semaine ?
        if (!sched.daysOfWeek.includes(local.dayOfWeek)) continue;

        // Bonne heure/minute ?
        if (local.hour !== sched.timeHour || local.minute !== sched.timeMinute) continue;

        // Dans la plage de dates ?
        const startIso = sched.startDate.toISOString().slice(0, 10);
        if (local.isoDate < startIso) continue;
        if (sched.endDate) {
          const endIso = sched.endDate.toISOString().slice(0, 10);
          if (local.isoDate > endIso) continue;
        }

        // Déjà déclenché cette minute ? (protection double-fire sur 30 s)
        const nowMin = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM (UTC)
        if (sched.lastFiredAt?.toISOString().slice(0, 16) === nowMin) continue;

        // Déclencher !
        log.info(
          { scheduleId: sched.id, circuitId: sched.circuitId, name: sched.name },
          'Scheduler: démarrage automatique de la session',
        );

        try {
          await orchestrator.start(sched.circuitId);
          await prisma.schedule.update({
            where: { id: sched.id },
            data:  { lastFiredAt: new Date() },
          });
          // Notifier les coaches qu'une session a démarré automatiquement
          hub.broadcastToCoaches({
            type:         'SESSION_AUTO_STARTED',
            scheduleId:   sched.id,
            scheduleName: sched.name,
          });
        } catch (err) {
          log.error({ scheduleId: sched.id, err }, 'Scheduler: échec du démarrage');
        }
      }
    } catch (err) {
      log.error({ err }, 'Scheduler: erreur dans le tick');
    } finally {
      busy = false;
    }
  }

  // Premier tick immédiat (au démarrage) puis toutes les 30 s
  void tick();
  const timer = setInterval(() => void tick(), 30_000);
  log.info('Scheduler démarré (intervalle 30 s)');

  return () => clearInterval(timer);
}
