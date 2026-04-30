#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const envPath = '.env.production';
const force = process.argv.includes('--force');
const pipedAnswers = input.isTTY ? null : readFileSync(0, 'utf8').split(/\r?\n/);
let pipedIndex = 0;

function secret(bytes = 36) {
  return randomBytes(bytes).toString('base64url');
}

function normalizeUrl(url) {
  return url.replace(/\/+$/, '');
}

async function ask(rl, question, fallback) {
  const suffix = fallback ? ` [${fallback}]` : '';
  if (pipedAnswers) {
    const answer = (pipedAnswers[pipedIndex++] ?? '').trim();
    output.write(`${question}${suffix}: ${answer}\n`);
    return answer || fallback;
  }
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

async function askPassword(rl, question, fallback, minLength = 12) {
  const value = await ask(rl, question, fallback);
  if (!value || value.length < minLength) {
    output.write(`Le secret doit contenir au moins ${minLength} caracteres.\n`);
    return askPassword(rl, question, fallback, minLength);
  }
  return value;
}

if (existsSync(envPath) && !force) {
  output.write(`${envPath} existe deja. Relance avec --force pour le remplacer.\n`);
  process.exit(1);
}

const rl = createInterface({ input, output });

try {
  output.write('\nCircuit Fit TV — assistant configuration production\n\n');

  const serverLanIp = await ask(rl, 'Adresse IP LAN stable du serveur', '192.168.1.10');
  const backendPort = await ask(rl, 'Port backend/PWA', '3000');
  const minioPort = await ask(rl, 'Port MinIO medias', '9000');
  const minioConsolePort = await ask(rl, 'Port console MinIO localhost', '9001');
  const postgresPort = await ask(rl, 'Port PostgreSQL localhost', '5432');
  const redisPort = await ask(rl, 'Port Redis localhost', '6379');
  const postgresUser = await ask(rl, 'Utilisateur PostgreSQL', 'cfitv');
  const postgresDb = await ask(rl, 'Base PostgreSQL', 'cfitv');
  const postgresPassword = await askPassword(rl, 'Mot de passe PostgreSQL', secret(24));
  const minioUser = await ask(rl, 'Utilisateur MinIO', 'cfitv_admin');
  const minioPassword = await askPassword(rl, 'Mot de passe MinIO/S3', secret(24));
  const jwtSecret = await askPassword(rl, 'JWT_SECRET 32+ caracteres', secret(48), 32);
  const jwtExpiresIn = await ask(rl, 'Duree session coach/admin', '8h');
  const adminEmail = await ask(rl, 'Email admin bootstrap optionnel', 'admin@example.com');
  const adminPassword = await askPassword(rl, 'Mot de passe admin bootstrap optionnel', secret(18));
  const backupRetentionDays = await ask(rl, 'Retention backups PostgreSQL en jours', '14');

  const s3Endpoint = normalizeUrl(`http://${serverLanIp}:${minioPort}`);
  const databaseUrl = `postgresql://${encodeURIComponent(postgresUser)}:${encodeURIComponent(postgresPassword)}@127.0.0.1:${postgresPort}/${encodeURIComponent(postgresDb)}?schema=public`;

  const content = `# ============================================================
# Circuit Fit TV — production locale generee
# ------------------------------------------------------------
# Genere par: npm run prod:setup
# Ne pas versionner ce fichier.
# ============================================================

SERVER_LAN_IP=${serverLanIp}

NODE_ENV=production
BACKEND_HOST=0.0.0.0
BACKEND_PORT=${backendPort}
LOG_LEVEL=info
MDNS_ENABLED=true

JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=${jwtExpiresIn}

ADMIN_EMAIL=${adminEmail}
ADMIN_INITIAL_PASSWORD=${adminPassword}

POSTGRES_USER=${postgresUser}
POSTGRES_PASSWORD=${postgresPassword}
POSTGRES_DB=${postgresDb}
POSTGRES_PORT=${postgresPort}
DATABASE_URL=${databaseUrl}

MINIO_ROOT_USER=${minioUser}
MINIO_ROOT_PASSWORD=${minioPassword}
MINIO_PORT=${minioPort}
MINIO_CONSOLE_PORT=${minioConsolePort}
S3_ENDPOINT=${s3Endpoint}
S3_ACCESS_KEY=${minioUser}
S3_SECRET_KEY=${minioPassword}
S3_BUCKET_VIDEOS=videos
S3_BUCKET_THUMBNAILS=thumbnails

REDIS_PORT=${redisPort}
REDIS_URL=redis://127.0.0.1:${redisPort}

BACKUP_INTERVAL_SECONDS=86400
BACKUP_RETENTION_DAYS=${backupRetentionDays}
`;

  writeFileSync(envPath, content, { mode: 0o600 });

  output.write(`\n${envPath} genere.\n\n`);
  output.write('Prochaines commandes:\n');
  output.write('  docker compose -f docker-compose.prod.yml --env-file .env.production config\n');
  output.write('  npm run prod:up\n');
  output.write('  npm run prod:logs\n\n');
} finally {
  rl.close();
}
