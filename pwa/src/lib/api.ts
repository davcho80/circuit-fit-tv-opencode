// ============================================================
// Client API typé — appels REST vers le backend Fastify
// En dev, les requêtes passent par le proxy Vite (vite.config.ts)
// En prod, BASE_URL est vide (même origine)
// ============================================================

// En dev : VITE_API_URL=http://localhost:3000 (défini dans .env.development)
// En prod : vide → même origine (Fastify sert le frontend)
const BASE: string = import.meta.env['VITE_API_URL'] ?? '';

async function request<T>(method: string, path: string, body?: unknown, fetchFn: typeof globalThis.fetch = globalThis.fetch): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // Injecter le token JWT si disponible (côté client uniquement)
  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('cfitv_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetchFn(`${BASE}${path}`, {
    method,
    headers,
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
  list(page = 1, limit = 20, fetchFn?: typeof globalThis.fetch): Promise<PaginatedExercises> {
    return request('GET', `/exercises?page=${page}&limit=${limit}`, undefined, fetchFn);
  },

  get(id: string, fetchFn?: typeof globalThis.fetch): Promise<Exercise> {
    return request('GET', `/exercises/${id}`, undefined, fetchFn);
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
  icon: string | null;
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
  icon?: string | null;
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
  list(fetchFn?: typeof globalThis.fetch): Promise<Circuit[]> {
    return request('GET', '/circuits', undefined, fetchFn);
  },

  get(id: string, fetchFn?: typeof globalThis.fetch): Promise<Circuit> {
    return request('GET', `/circuits/${id}`, undefined, fetchFn);
  },

  create(data: CircuitCreate): Promise<Circuit> {
    return request('POST', '/circuits', data);
  },

  update(id: string, data: Partial<Omit<CircuitCreate, 'stations' | 'scheduledBreaks'>>): Promise<Circuit> {
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

// ---- Types Stats ----

export interface Stats {
  total:          number;
  last7Days:      number;
  last30Days:     number;
  completed:      number;
  aborted:        number;
  completionRate: number;
  avgDurationMin: number;
  topCircuits:    Array<{ circuitId: string; name: string; count: number }>;
  byDay:          Array<{ day: string; count: number }>;
}

export const stats = {
  get(fetchFn?: typeof globalThis.fetch): Promise<Stats> {
    return request('GET', '/stats', undefined, fetchFn);
  },
  exportCsvUrl(): string {
    const BASE: string = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';
    return `${BASE}/stats/export.csv`;
  },
};

// ---- Types Session ----

export type SessionStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ABORTED';

export interface SessionHistory {
  id:            string;
  circuitId:     string;
  circuit:       { name: string };
  startedAt:     string;
  endedAt:       string | null;
  status:        SessionStatus;
  currentRound:  number;
}

export const sessions = {
  list(fetchFn?: typeof globalThis.fetch): Promise<SessionHistory[]> {
    return request('GET', '/sessions', undefined, fetchFn);
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
  list(fetchFn?: typeof globalThis.fetch): Promise<Display[]> {
    return request('GET', '/displays', undefined, fetchFn);
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
  list(fetchFn?: typeof globalThis.fetch): Promise<Schedule[]> {
    return request('GET', '/schedules', undefined, fetchFn);
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

// ---- Types Studio Settings ----

export interface StudioSettings {
  id:           string;
  studioName:   string;
  primaryColor: string;
  logoUrl:      string | null;
  timezone:     string;
}

export interface SettingsPatch {
  studioName?:   string;
  primaryColor?: string;
  logoUrl?:      string | null;
  timezone?:     string;
}

// ---- Settings ----

export const settings = {
  get(fetchFn?: typeof globalThis.fetch): Promise<StudioSettings> {
    return request('GET', '/settings', undefined, fetchFn);
  },

  patch(data: SettingsPatch): Promise<StudioSettings> {
    return request('PATCH', '/settings', data);
  },

  uploadLogo(file: File, onProgress?: (pct: number) => void): Promise<StudioSettings> {
    return new Promise((resolve, reject) => {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('cfitv_token') : null;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/settings/logo`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText) as StudioSettings);
        else reject(new Error(`Logo upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });
  },
};

// ---- Types Auth ----

export interface UserPublic {
  id:                 string;
  email:              string;
  role:               'ADMIN' | 'COACH';
  mustChangePassword: boolean;
  lastLoginAt:        string | null;
  createdAt:          string;
}

export interface LoginResponse {
  token: string;
  user:  UserPublic;
}

// ---- Auth ----

export const auth = {
  login(email: string, password: string): Promise<LoginResponse> {
    return request('POST', '/auth/login', { email, password });
  },

  me(fetchFn?: typeof globalThis.fetch): Promise<UserPublic> {
    return request('GET', '/auth/me', undefined, fetchFn);
  },

  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return request('POST', '/auth/change-password', { currentPassword, newPassword });
  },
};

// ---- Users ----

export interface UserCreate {
  email:    string;
  password: string;
  role:     'ADMIN' | 'COACH';
}

export interface UserPatch {
  role?:     'ADMIN' | 'COACH';
  password?: string;
}

export const users = {
  list(): Promise<UserPublic[]> {
    return request('GET', '/users');
  },

  create(data: UserCreate): Promise<UserPublic> {
    return request('POST', '/users', data);
  },

  patch(id: string, data: UserPatch): Promise<UserPublic> {
    return request('PATCH', `/users/${id}`, data);
  },

  delete(id: string): Promise<void> {
    return request('DELETE', `/users/${id}`);
  },
};

// ---- Types Update ----

export interface UpdateStatus {
  currentVersion:  string;
  latestVersion:   string | null;
  updateAvailable: boolean;
  changelog:       string | null;
  releaseUrl:      string | null;
  publishedAt:     string | null;
  canUpdate:       boolean;
}

// ---- Update ----

export const update = {
  status(): Promise<UpdateStatus> {
    return request('GET', '/update/status');
  },

  start(): Promise<{ status: string }> {
    return request('POST', '/update/start');
  },

  /** Consomme le flux SSE de logs et appelle onLine pour chaque ligne, onDone à la fin */
  stream(onLine: (line: string) => void, onDone: () => void): () => void {
    const base: string = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('cfitv_token') : null;

    const ctrl = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${base}/update/stream`, {
          signal:  ctrl.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok || !res.body) { onDone(); return; }

        const reader = res.body.getReader();
        const dec    = new TextDecoder();
        let buf      = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try { onLine(JSON.parse(line.slice(6)) as string); } catch { /* skip */ }
            }
            if (line.startsWith('event: done')) { onDone(); return; }
          }
        }
      } catch { /* aborted or network error */ }
      onDone();
    })();

    return () => ctrl.abort();
  },
};
