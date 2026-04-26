// Configuration Prisma 7 — utilisée par `prisma migrate` et `prisma generate`
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

// Charge le .env racine du monorepo (Prisma 7 ne le fait pas automatiquement)
const rootEnv = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
try { process.loadEnvFile(rootEnv); } catch { /* pas de .env = variables déjà injectées (CI, prod) */ }

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
  migrate: {
    async adapter(env: Record<string, string | undefined>) {
      const connectionString = env['DATABASE_URL'];
      if (!connectionString) throw new Error('DATABASE_URL is required');
      return new PrismaPg({ connectionString });
    },
  },
});
