// ============================================================
// Client S3/MinIO partagé
// MinIO est S3-compatible, on utilise l'AWS SDK.
// ============================================================

import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { config } from './config.js';

export const s3 = new S3Client({
  endpoint: config.s3.endpoint,
  region: 'us-east-1', // obligatoire pour le SDK, ignoré par MinIO
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  forcePathStyle: true, // requis pour MinIO (path-style vs virtual-hosted)
});

/** Crée un bucket s'il n'existe pas déjà. Appelé au démarrage. */
export async function ensureBuckets(): Promise<void> {
  for (const bucket of [config.s3.bucketVideos, config.s3.bucketThumbnails]) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    }
  }
}

/** URL publique d'un objet MinIO (pour dev — en prod, utiliser un CDN ou pre-signed URL). */
export function publicUrl(bucket: string, key: string): string {
  return `${config.s3.endpoint}/${bucket}/${key}`;
}
