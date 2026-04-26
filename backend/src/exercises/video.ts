// ============================================================
// Pipeline upload vidéo : temp file → FFmpeg → MinIO
// ============================================================
//
// Flux :
//   1. Le fichier multipart est streamé dans un temp file
//   2. FFmpeg transcode en H.264 720p + extrait un thumbnail JPEG
//   3. Les deux fichiers sont uploadés sur MinIO via multipart upload
//   4. Les URLs sont retournées (videoUrl, thumbnailUrl, durationSec)
//   5. Les temp files sont supprimés
//
// ============================================================

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createReadStream, createWriteStream } from 'node:fs';
import { unlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { Upload } from '@aws-sdk/lib-storage';
import { s3, publicUrl } from '../storage.js';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

export interface VideoUploadResult {
  videoUrl: string;
  thumbnailUrl: string;
  durationSec: number;
}

/**
 * Traite un upload vidéo pour un exercice.
 * @param stream  Readable stream du fichier uploadé
 * @param exerciseId  UUID de l'exercice
 */
export async function processVideoUpload(
  stream: Readable,
  exerciseId: string,
): Promise<VideoUploadResult> {
  const tmpDir = join(tmpdir(), 'cfitv', exerciseId);
  await mkdir(tmpDir, { recursive: true });

  const inputPath = join(tmpDir, 'input');
  const outputPath = join(tmpDir, 'output.mp4');
  const thumbPath = join(tmpDir, 'thumb.jpg');

  try {
    // 1. Sauvegarder le stream entrant dans un fichier temp
    await pipeline(stream, createWriteStream(inputPath));

    // 2. Détecter la durée de la vidéo source
    const durationSec = await getVideoDuration(inputPath);

    // 3. Transcodage 720p H.264 + extraction du thumbnail à 1 s
    await Promise.all([
      transcodeVideo(inputPath, outputPath),
      extractThumbnail(inputPath, thumbPath),
    ]);

    // 4. Upload sur MinIO en parallèle
    const videoKey = `exercises/${exerciseId}/video.mp4`;
    const thumbKey = `exercises/${exerciseId}/thumb.jpg`;

    await Promise.all([
      uploadToS3(outputPath, config.s3.bucketVideos, videoKey, 'video/mp4'),
      uploadToS3(thumbPath, config.s3.bucketThumbnails, thumbKey, 'image/jpeg'),
    ]);

    return {
      videoUrl: publicUrl(config.s3.bucketVideos, videoKey),
      thumbnailUrl: publicUrl(config.s3.bucketThumbnails, thumbKey),
      durationSec,
    };
  } finally {
    // 5. Nettoyage temp files (best effort)
    await Promise.allSettled([
      unlink(inputPath),
      unlink(outputPath),
      unlink(thumbPath),
    ]);
  }
}

// ---- Helpers privés ----

async function getVideoDuration(input: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    input,
  ]);
  return Math.round(Number(stdout.trim()));
}

async function transcodeVideo(input: string, output: string): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-i', input,
    '-vf', 'scale=-2:720',      // 720p, largeur auto (multiple de 2)
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',               // qualité raisonnable
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',  // streaming progressif
    '-y',                       // écraser si existe
    output,
  ]);
}

async function extractThumbnail(input: string, output: string): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-i', input,
    '-ss', '00:00:01',          // à 1 seconde
    '-vframes', '1',
    '-vf', 'scale=-2:360',      // thumbnail 360p
    '-y',
    output,
  ]);
}

async function uploadToS3(
  filePath: string,
  bucket: string,
  key: string,
  contentType: string,
): Promise<void> {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
    },
  });
  await upload.done();
}

// Export pour tests
export { randomUUID };
