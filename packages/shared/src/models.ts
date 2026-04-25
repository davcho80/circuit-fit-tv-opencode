// ============================================================
// Modèles de données partagés
// ------------------------------------------------------------
// Ces schémas Zod servent de source de vérité pour :
//   - la validation des payloads API (côté backend)
//   - les types TypeScript inférés (backend + PWA)
//   - la documentation de la forme des données
//
// Les modèles Prisma (backend/prisma/schema.prisma) doivent
// rester cohérents avec ces schémas. Si un champ change ici,
// il doit changer là-bas aussi (et réciproquement).
// ============================================================

import { z } from 'zod';

// ----- Enums -----

export const Difficulty = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
export type Difficulty = z.infer<typeof Difficulty>;

export const RotationMode = z.enum(['CLASSIC', 'FIXED']);
export type RotationMode = z.infer<typeof RotationMode>;

export const DisplayRole = z.enum(['STATION', 'CENTRAL', 'UNASSIGNED']);
export type DisplayRole = z.infer<typeof DisplayRole>;

export const SessionStatus = z.enum([
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'ABORTED',
]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const PhaseType = z.enum(['TRANSITION', 'WORK', 'REST']);
export type PhaseType = z.infer<typeof PhaseType>;

// ----- Exercise -----

export const Exercise = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(280).nullable(),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url(),
  durationSec: z.number().int().positive(),
  muscleGroups: z.array(z.string()).default([]),
  equipment: z.array(z.string()).default([]),
  difficulty: Difficulty,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Exercise = z.infer<typeof Exercise>;

// Pour la création (sans id, timestamps auto-générés)
export const ExerciseCreate = Exercise.omit({
  id: true,
  videoUrl: true,
  thumbnailUrl: true,
  durationSec: true,
  createdAt: true,
  updatedAt: true,
});
export type ExerciseCreate = z.infer<typeof ExerciseCreate>;

// ----- Circuit -----

export const CircuitStation = z.object({
  id: z.string().uuid(),
  circuitId: z.string().uuid(),
  position: z.number().int().min(1),
  exerciseIds: z.array(z.string().uuid()).min(1),
});
export type CircuitStation = z.infer<typeof CircuitStation>;

export const Circuit = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  rounds: z.number().int().min(1).max(10),
  workSec: z.number().int().min(5).max(600),
  restSec: z.number().int().min(0).max(300),
  transitionSec: z.number().int().min(0).max(60),
  rotationMode: RotationMode,
  stations: z.array(CircuitStation).min(2).max(20),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Circuit = z.infer<typeof Circuit>;

export const CircuitCreate = Circuit.omit({
  id: true,
  stations: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  stations: z
    .array(
      CircuitStation.omit({ id: true, circuitId: true, position: true }).extend({
        position: z.number().int().min(1),
      }),
    )
    .min(2)
    .max(20),
});
export type CircuitCreate = z.infer<typeof CircuitCreate>;

// ----- Display -----

export const Display = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  role: DisplayRole,
  stationNumber: z.number().int().positive().nullable(),
  lastSeen: z.string().datetime().nullable(),
  deviceInfo: z
    .object({
      model: z.string().optional(),
      os: z.string().optional(),
      appVersion: z.string().optional(),
    })
    .nullable(),
  pairedAt: z.string().datetime().nullable(),
});
export type Display = z.infer<typeof Display>;

// ----- Session -----

export const Session = z.object({
  id: z.string().uuid(),
  circuitId: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  status: SessionStatus,
  currentRound: z.number().int().min(1),
  currentPhase: PhaseType,
  currentStationIdx: z.number().int().min(0),
  phaseEndsAt: z.string().datetime().nullable(),
});
export type Session = z.infer<typeof Session>;
