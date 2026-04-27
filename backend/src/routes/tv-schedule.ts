// ============================================================
// Route TV Schedule
// GET /tv-schedule   → cours prévus pour les 7 prochains jours
// Public (écrans TV, pas d'auth nécessaire)
// ============================================================

import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

interface ScheduledDay {
  date:     string;        // YYYY-MM-DD
  label:    string;        // "Lundi 27 avr."
  dayOfWeek: number;       // ISO 1=Lun…7=Dim
  classes:  ScheduledClass[];
}

interface ScheduledClass {
  scheduleId: string;
  circuitId:  string;
  name:       string;
  icon:       string | null;
  timeHour:   number;
  timeMinute: string;      // "09:30"
}

export async function tvScheduleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/tv-schedule', async () => {
    const schedules = await prisma.schedule.findMany({
      where:   { isActive: true },
      include: { circuit: { select: { name: true, icon: true as true } } },
      orderBy: [{ timeHour: 'asc' }, { timeMinute: 'asc' }],
    });

    const days: ScheduledDay[] = [];
    const now = new Date();

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);

      // ISO day of week : getDay() → 0=Sun,1=Mon…6=Sat ; on veut 1=Mon…7=Sun
      const jsDay = d.getDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;

      const dateStr = d.toISOString().slice(0, 10);
      const label   = d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'short' });

      const classes = schedules
        .filter((s) => {
          if (!s.daysOfWeek.includes(isoDay)) return false;
          // Vérifier la plage de dates
          const start = new Date(s.startDate); start.setHours(0, 0, 0, 0);
          if (d < start) return false;
          if (s.endDate) {
            const end = new Date(s.endDate); end.setHours(23, 59, 59, 999);
            if (d > end) return false;
          }
          return true;
        })
        .map((s) => ({
          scheduleId: s.id,
          circuitId:  s.circuitId,
          name:       s.circuit.name,
          icon:       s.circuit.icon,
          timeHour:   s.timeHour,
          timeMinute: `${String(s.timeHour).padStart(2, '0')}:${String(s.timeMinute).padStart(2, '0')}`,
        }))
        .sort((a, b) => a.timeHour - b.timeHour);

      days.push({ date: dateStr, label, dayOfWeek: isoDay, classes });
    }

    return days;
  });
}
