// ============================================================
// Client API typé — appels REST vers le backend Fastify
// En dev, les requêtes passent par le proxy Vite (vite.config.ts)
// En prod, BASE_URL est vide (même origine)
// ============================================================

// En dev : VITE_API_URL=http://localhost:3000 (défini dans .env.development)
// En prod : vide → même origine (Fastify sert le frontend)
const BASE: string = import.meta.env['VITE_API_URL'] ?? '';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- Types locaux (repris des modèles Zod) ----

export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface Exercise {
  id: string;
  name: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string;
  durationSec: number;
  muscleGroups: string[];
  equipment: string[];
  difficulty: Difficulty;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseCreate {
  name: string;
  description?: string | null;
  difficulty: Difficulty;
  muscleGroups?: string[];
  equipment?: string[];
}

export interface PaginatedExercises {
  items: Exercise[];
  total: number;
  page: number;
  limit: number;
}

// ---- Exercises ----

export const exercises = {
  list(page = 1, limit = 20): Promise<PaginatedExercises> {
    return request('GET', `/exercises?page=${page}&limit=${limit}`);
  },

  get(id: string): Promise<Exercise> {
    return request('GET', `/exercises/${id}`);
  },

  create(data: ExerciseCreate): Promise<Exercise> {
    return request('POST', '/exercises', data);
  },

  update(id: string, data: Partial<ExerciseCreate>): Promise<Exercise> {
    return request('PATCH', `/exercises/${id}`, data);
  },

  delete(id: string): Promise<void> {
    return request('DELETE', `/exercises/${id}`);
  },

  /**
   * Upload une vidéo avec suivi de progression.
   * Utilise XHR pour le progress event (fetch ne le supporte pas en upload).
   */
  uploadVideo(
    id: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<Exercise> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/exercises/${id}/video`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText) as Exercise);
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.ontimeout = () => reject(new Error('Upload timeout'));
      xhr.timeout = 5 * 60 * 1000; // 5 min max

      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });
  },
};

// ---- Types Circuits ----

export type RotationMode = 'CLASSIC' | 'FIXED';

export interface CircuitStationData {
  id: string;
  circuitId: string;
  position: number;
  layoutX: number | null;
  layoutY: number | null;
  exercises: Array<{ exercise: Exercise }>;
}

export interface ScheduledBreak {
  id?: string;
  afterRound:  number;
  durationSec: number;
  label:       string;
}

export interface Circuit {
  id: string;
  name: string;
  description: string | null;
  rounds: number;
  workSec: number;
  restSec: number;
  transitionSec: number;
  rotationMode: RotationMode;
  stations: CircuitStationData[];
  scheduledBreaks: ScheduledBreak[];
  createdAt: string;
  updatedAt: string;
}

export interface CircuitStationInput {
  position: number;
  exerciseIds: string[];
  layoutX?: number | null;
  layoutY?: number | null;
}

export interface CircuitCreate {
  name: string;
  description?: string | null;
  rounds: number;
  workSec: number;
  restSec: number;
  transitionSec: number;
  rotationMode: RotationMode;
  stations: CircuitStationInput[];
  scheduledBreaks?: Array<{ afterRound: number; durationSec: number; label?: string }>;
}

// ---- Circuits ----

export const circuits = {
  list(): Promise<Circuit[]> {
    return request('GET', '/circuits');
  },

  get(id: string): Promise<Circuit> {
    return request('GET', `/circuits/${id}`);
  },

  create(data: CircuitCreate): Promise<Circuit> {
    return request('POST', '/circuits', data);
  },

  update(id: string, data: Partial<Omit<CircuitCreate, 'stations'>>): Promise<Circuit> {
    return request('PATCH', `/circuits/${id}`, data);
  },

  delete(id: string): Promise<void> {
    return request('DELETE', `/circuits/${id}`);
  },

  updateLayout(
    id: string,
    stations: Array<{ id: string; layoutX: number; layoutY: number }>,
  ): Promise<Circuit> {
    return request('PATCH', `/circuits/${id}/layout`, { stations });
  },

  updateStations(
    id: string,
    stations: Array<{ position: number; exerciseIds: string[]; layoutX?: number | null; layoutY?: number | null }>,
  ): Promise<Circuit> {
    return request('PUT', `/circuits/${id}/stations`, { stations });
  },

  updateBreaks(
    id: string,
    breaks: Array<{ afterRound: number; durationSec: number; label?: string }>,
  ): Promise<Circuit> {
    return request('PUT', `/circuits/${id}/breaks`, { breaks });
  },
};

// ---- Types Display ----

export type DisplayRole = 'STATION' | 'CENTRAL' | 'UNASSIGNED';

export interface Display {
  id:            string;
  name:          string;
  role:          DisplayRole;
  stationNumber: number | null;
  lastSeen:      string | null;
  deviceModel:   string | null;
  deviceOs:      string | null;
  appVersion:    string | null;
  pairedAt:      string | null;
}

export interface DisplayPatch {
  name?:          string;
  role?:          DisplayRole;
  stationNumber?: number | null;
}

// ---- Displays ----

export const displays = {
  list(): Promise<Display[]> {
    return request('GET', '/displays');
  },

  update(id: string, data: DisplayPatch): Promise<Display> {
    return request('PATCH', `/displays/${id}`, data);
  },

  delete(id: string): Promise<void> {
    return request('DELETE', `/displays/${id}`);
  },
};

// ---- Types Schedule ----

export interface Schedule {
  id:          string;
  circuitId:   string;
  circuit:     { name: string };
  name:        string;
  daysOfWeek:  number[];   // ISO 1=Lun…7=Dim
  timeHour:    number;
  timeMinute:  number;
  timezone:    string;
  startDate:   string;     // ISO date YYYY-MM-DD
  endDate:     string | null;
  isActive:    boolean;
  lastFiredAt: string | null;
  createdAt:   string;
  updatedAt:   string;
}

export interface ScheduleCreate {
  circuitId:   string;
  name:        string;
  daysOfWeek:  number[];
  timeHour:    number;
  timeMinute:  number;
  timezone?:   string;
  startDate:   string;
  endDate?:    string | null;
  isActive?:   boolean;
}

// ---- Schedules ----

export const schedules = {
  list(): Promise<Schedule[]> {
    return request('GET', '/schedules');
  },

  create(data: ScheduleCreate): Promise<Schedule> {
    return request('POST', '/schedules', data);
  },

  update(id: string, data: Partial<ScheduleCreate>): Promise<Schedule> {
    return request('PATCH', `/schedules/${id}`, data);
  },

  delete(id: string): Promise<void> {
    return request('DELETE', `/schedules/${id}`);
  },
};
