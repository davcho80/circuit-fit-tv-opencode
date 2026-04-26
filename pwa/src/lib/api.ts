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
