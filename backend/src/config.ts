// ============================================================
// Variables d'environnement typées
// Échoue au démarrage si une variable requise est absente.
// ============================================================

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(optional('BACKEND_PORT', '3000')),
  host: optional('BACKEND_HOST', '0.0.0.0'),
  nodeEnv: optional('NODE_ENV', 'development'),
  logLevel: optional('LOG_LEVEL', 'info'),

  databaseUrl: required('DATABASE_URL'),

  s3: {
    endpoint: optional('S3_ENDPOINT', 'http://localhost:9000'),
    accessKey: optional('S3_ACCESS_KEY', 'cfitv_admin'),
    secretKey: optional('S3_SECRET_KEY', 'cfitv_dev_password'),
    bucketVideos: optional('S3_BUCKET_VIDEOS', 'videos'),
    bucketThumbnails: optional('S3_BUCKET_THUMBNAILS', 'thumbnails'),
  },

  jwtSecret: optional('JWT_SECRET', 'cfitv_dev_jwt_secret_change_in_production_32c'),

  adminEmail:           optional('ADMIN_EMAIL', ''),
  adminInitialPassword: optional('ADMIN_INITIAL_PASSWORD', ''),

  get isDev(): boolean {
    return this.nodeEnv !== 'production';
  },
} as const;
