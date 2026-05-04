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

const nodeEnv = optional('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

function requiredInProduction(name: string, fallback: string): string {
  return isProduction ? required(name) : optional(name, fallback);
}

function secretInProduction(name: string, fallback: string, minLength: number): string {
  const val = requiredInProduction(name, fallback);
  if (isProduction && val === fallback) {
    throw new Error(`${name} must not use the development default in production`);
  }
  if (isProduction && val.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters in production`);
  }
  return val;
}

export const config = {
  port: Number(optional('BACKEND_PORT', '3000')),
  host: optional('BACKEND_HOST', '0.0.0.0'),
  nodeEnv,
  logLevel: optional('LOG_LEVEL', 'info'),

  databaseUrl: required('DATABASE_URL'),

  s3: {
    endpoint: optional('S3_ENDPOINT', 'http://localhost:9000'),
    accessKey: secretInProduction('S3_ACCESS_KEY', 'cfitv_admin', 8),
    secretKey: secretInProduction('S3_SECRET_KEY', 'cfitv_dev_password', 16),
    bucketVideos: optional('S3_BUCKET_VIDEOS', 'videos'),
    bucketThumbnails: optional('S3_BUCKET_THUMBNAILS', 'thumbnails'),
  },

  jwtSecret: secretInProduction('JWT_SECRET', 'cfitv_dev_jwt_secret_change_in_production_32c', 32),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '30d'),

  adminEmail:           optional('ADMIN_EMAIL', ''),
  adminInitialPassword: optional('ADMIN_INITIAL_PASSWORD', ''),

  get isDev(): boolean {
    return !isProduction;
  },
} as const;
