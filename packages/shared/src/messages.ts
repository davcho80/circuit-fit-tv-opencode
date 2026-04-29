// ============================================================
// Messages WebSocket (source de vérité partagée)
// ------------------------------------------------------------
// Discriminated union sur la propriété `type`.
// Côté serveur : on valide les messages entrants avec ClientMessage.parse()
// Côté client : on type les messages reçus via le discriminant `type`
//
// Convention :
//   - ClientMessage : client → serveur
//   - ServerMessage : serveur → client
//   - tout timestamp est un number (epoch ms), absolu
// ============================================================

import { z } from 'zod';
import { PhaseType, SessionStatus } from './models.js';

// ============================================================
// Messages CLIENT → SERVEUR
// ============================================================

// Annonce l'identité du client à la connexion
export const RegisterMsg = z.object({
  type: z.literal('REGISTER'),
  role: z.enum(['tv', 'coach', 'monitor']),
  label: z.string().min(1).max(50),
  displayId: z.string().uuid().optional(), // null si TV pas encore appairée
});

// Ping de synchronisation d'horloge (NTP-like)
export const ClockPingMsg = z.object({
  type: z.literal('CLOCK_PING'),
  clientT0: z.number().int(), // epoch ms au moment d'envoi côté client
});

// Heartbeat de keepalive
export const HeartbeatMsg = z.object({
  type: z.literal('HEARTBEAT'),
  t: z.number().int(),
});

// Commandes du coach
export const StartCommand = z.object({
  type: z.literal('START'),
  circuitId: z.string().uuid(),
});
export const PauseCommand = z.object({ type: z.literal('PAUSE') });
export const ResumeCommand = z.object({ type: z.literal('RESUME') });
export const SkipCommand = z.object({ type: z.literal('SKIP') });
export const StopCommand = z.object({ type: z.literal('STOP') });
export const AdjustCommand = z.object({
  type: z.literal('ADJUST'),
  deltaMs: z.number().int(), // positif pour ajouter, négatif pour retirer
});
export const HydrationBreakCommand = z.object({
  type: z.literal('HYDRATION_BREAK'),
  durationMs: z.number().int().min(10_000).max(600_000), // 10 s → 10 min
});

// Télémétrie envoyée par les TV (utile pour la page drift et le debug)
export const DriftReportMsg = z.object({
  type: z.literal('DRIFT_REPORT'),
  phaseEndsAt: z.number().int().nullable(),
  remainingMs: z.number().int(),
  displayedSec: z.number().int(),
  offsetMs: z.number(),
  rttMs: z.number(),
  clientNow: z.number().int(),
});

// TV → Serveur : enregistre un code PIN d'appairage
export const PairRegisterMsg = z.object({
  type:        z.literal('PAIR_REGISTER'),
  pin:         z.string().length(4),
  deviceModel: z.string().optional(),
  deviceOs:    z.string().optional(),
  appVersion:  z.string().optional(),
});

export const ClientMessage = z.discriminatedUnion('type', [
  RegisterMsg,
  ClockPingMsg,
  HeartbeatMsg,
  StartCommand,
  PauseCommand,
  ResumeCommand,
  SkipCommand,
  StopCommand,
  AdjustCommand,
  HydrationBreakCommand,
  DriftReportMsg,
  PairRegisterMsg,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ============================================================
// Messages SERVEUR → CLIENT
// ============================================================

export const WelcomeMsg = z.object({
  type: z.literal('WELCOME'),
  clientId: z.string().uuid(),
  serverTime: z.number().int(),
});

export const ClockPongMsg = z.object({
  type: z.literal('CLOCK_PONG'),
  clientT0: z.number().int(), // renvoyé pour corrélation
  serverT1: z.number().int(), // epoch ms à la réception du PING
  serverT2: z.number().int(), // epoch ms à l'envoi du PONG
});

export const HeartbeatAckMsg = z.object({
  type: z.literal('HEARTBEAT_ACK'),
  serverTime: z.number().int(),
});

// Snapshot de l'état de session diffusé à tout nouveau client
// et à chaque changement de phase
export const SessionUpdateMsg = z.object({
  type: z.literal('SESSION_UPDATE'),
  payload: z
    .object({
      id: z.string().uuid(),
      status: SessionStatus,
      circuitId: z.string().uuid(),
      currentPhaseIdx: z.number().int(),
      totalPhases: z.number().int(),
      round: z.number().int(),       // round courant (1-based)
      totalRounds: z.number().int(), // nombre total de rounds
      stationIdx: z.number().int(),  // index (0-based) de la station active
      phase: z.object({
        type: PhaseType,
        label: z.string(),
        durationMs: z.number().int(),
        // Champs supplémentaires pour le mode REPS
        setNumber:  z.number().int().optional(),
        totalSets:  z.number().int().optional(),
        reps:       z.number().int().optional(),
        isRepsMode: z.boolean().optional(),
      }),
      phaseStartsAt: z.number().int(),
      phaseEndsAt: z.number().int(),
      pausedAt: z.number().int().nullable(),
      remainingOnPauseMs: z.number().int().nullable(),
      hydrationBreakEndsAt: z.number().int().nullable().optional(),
    })
    .nullable(), // null quand il n'y a pas de session active
});

// État spécifique à une TV station (exercice courant, URL vidéo)
export const DisplayStateMsg = z.object({
  type: z.literal('DISPLAY_STATE'),
  stationNumber: z.number().int().positive(),
  exerciseIds: z.array(z.string().uuid()),
  videoUrls: z.array(z.string().url()),
  exerciseNames: z.array(z.string()),
});

// État spécifique à la TV centrale (vue globale)
export const CircuitStateMsg = z.object({
  type: z.literal('CIRCUIT_STATE'),
  round: z.number().int(),
  totalRounds: z.number().int(),
  stations: z.array(
    z.object({
      position: z.number().int(),
      exerciseName: z.string(),
    }),
  ),
});

export const SessionEndedMsg = z.object({
  type: z.literal('SESSION_ENDED'),
  reason: z.enum(['completed', 'stopped', 'error']),
});

// Liste des clients connectés (diffusée au coach)
export const ClientListMsg = z.object({
  type: z.literal('CLIENT_LIST'),
  payload: z.array(
    z.object({
      id:          z.string().uuid(),
      role:        z.string(),
      label:       z.string(),
      displayId:   z.string().nullable(),
      connectedAt: z.number().int(),
    }),
  ),
});

// Notification : le scheduler a démarré une session automatiquement
export const SessionAutoStartedMsg = z.object({
  type:         z.literal('SESSION_AUTO_STARTED'),
  scheduleId:   z.string().uuid(),
  scheduleName: z.string(),
});

// Relais de télémétrie drift vers le coach / monitor
export const DriftDataMsg = z.object({
  type: z.literal('DRIFT_DATA'),
  clientId: z.string().uuid(),
  label: z.string(),
  phaseEndsAt: z.number().int().nullable(),
  remainingMs: z.number().int(),
  displayedSec: z.number().int(),
  offsetMs: z.number(),
  rttMs: z.number(),
  clientNow: z.number().int(),
});

// Erreur métier renvoyée à un client spécifique
export const ErrorMsg = z.object({
  type: z.literal('ERROR'),
  code: z.string(),
  message: z.string(),
});

// Serveur → TV : config poussée après validation du PIN par l'admin
export const PairConfigMsg = z.object({
  type:         z.literal('PAIR_CONFIG'),
  label:        z.string().min(1).max(50),
  stationNumber: z.number().int().min(1).max(20),
  screenType:   z.enum(['STATION', 'DASHBOARD']),
  isLandscape:  z.boolean(),
  primaryColor: z.string().optional(),   // couleur principale du studio
  logoUrl:      z.string().nullable().optional(),  // URL du logo studio
});

export const ServerMessage = z.discriminatedUnion('type', [
  WelcomeMsg,
  ClockPongMsg,
  HeartbeatAckMsg,
  SessionUpdateMsg,
  DisplayStateMsg,
  CircuitStateMsg,
  SessionEndedMsg,
  ClientListMsg,
  SessionAutoStartedMsg,
  DriftDataMsg,
  ErrorMsg,
  PairConfigMsg,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

// Helpers d'affinage pour avoir le typage correct après pattern match
export type ClientMessageOfType<T extends ClientMessage['type']> = Extract<
  ClientMessage,
  { type: T }
>;
export type ServerMessageOfType<T extends ServerMessage['type']> = Extract<
  ServerMessage,
  { type: T }
>;
