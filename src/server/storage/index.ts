import 'server-only';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/lib/env';
import { unavailable, validation } from '@/lib/errors';
import { log } from '@/lib/logger';
import {
  ALLOWED_FILE_TYPES,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
} from '@/lib/validation/schemas';

const logger = log('storage');

/**
 * Object storage.
 *
 * Two buckets with different exposure:
 *   * PUBLIC  — product images, avatars. Cacheable, served directly.
 *   * PRIVATE — paid deliverables. Never public. Reachable only through a
 *     short-lived signed URL minted after an entitlement check.
 *
 * The bucket is never addressed from the browser and object keys are opaque
 * UUIDs, so guessing a key gains nothing without a signature.
 */

export type UploadKind = 'product-image' | 'product-file' | 'avatar';

const KIND_CONFIG: Record<
  UploadKind,
  { bucket: 'public' | 'private'; types: readonly string[]; maxBytes: number }
> = {
  'product-image': {
    bucket: 'public',
    types: ALLOWED_IMAGE_TYPES,
    maxBytes: MAX_IMAGE_BYTES,
  },
  avatar: {
    bucket: 'public',
    types: ALLOWED_IMAGE_TYPES,
    maxBytes: MAX_IMAGE_BYTES,
  },
  'product-file': {
    bucket: 'private',
    types: ALLOWED_FILE_TYPES,
    maxBytes: MAX_FILE_BYTES,
  },
};

let client: S3Client | null = null;

function s3(): S3Client {
  if (env.STORAGE_DRIVER !== 's3') {
    throw unavailable(
      'O armazenamento de arquivos não está configurado neste ambiente.'
    );
  }

  client ??= new S3Client({
    region: env.S3_REGION,
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });

  return client;
}

function bucketFor(kind: 'public' | 'private'): string {
  const name = kind === 'private' ? env.S3_BUCKET_PRIVATE : env.S3_BUCKET_PUBLIC;
  if (!name) {
    throw unavailable('Bucket de armazenamento não configurado.');
  }
  return name;
}

export const isStorageConfigured = env.STORAGE_DRIVER === 's3';

/**
 * Validates an upload request and mints an opaque storage key.
 *
 * The declared content type and size are checked here, but they are only a
 * *claim* by the client. The signed PUT below pins the content type and length
 * into the signature, so S3 rejects a payload that does not match what was
 * approved — a client cannot promise a PNG and upload a script.
 */
export function planUpload(input: {
  kind: UploadKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): { key: string; bucket: 'public' | 'private' } {
  const config = KIND_CONFIG[input.kind];

  if (!config.types.includes(input.contentType)) {
    throw validation(
      `Tipo de arquivo não permitido para ${input.kind}.`,
      { contentType: ['Tipo de arquivo não permitido.'] }
    );
  }

  if (input.sizeBytes > config.maxBytes) {
    const mb = Math.floor(config.maxBytes / (1024 * 1024));
    throw validation(`Arquivo maior que o limite de ${mb} MB.`, {
      sizeBytes: [`Limite de ${mb} MB.`],
    });
  }

  // The original name is never part of the key: it is attacker-controlled and
  // only reintroduced at download time as a Content-Disposition filename.
  const ext = extname(input.fileName).toLowerCase().slice(0, 10);
  const safeExt = /^\.[a-z0-9]{1,9}$/.test(ext) ? ext : '';
  const key = `${input.kind}/${new Date().getFullYear()}/${randomUUID()}${safeExt}`;

  return { key, bucket: config.bucket };
}

/** Presigned PUT for a direct browser upload. Expires in 5 minutes. */
export async function createUploadUrl(input: {
  kind: UploadKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): Promise<{ url: string; key: string }> {
  const { key, bucket } = planUpload(input);

  const command = new PutObjectCommand({
    Bucket: bucketFor(bucket),
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
  });

  const url = await getSignedUrl(s3(), command, { expiresIn: 300 });

  return { url, key };
}

/**
 * Short-lived signed GET for a private deliverable.
 *
 * Callers MUST have verified entitlement before calling this — the signature
 * grants access to anyone holding the URL for its lifetime, which is why the
 * TTL is minutes rather than hours.
 */
export async function createDownloadUrl(
  key: string,
  downloadFileName: string
): Promise<string> {
  // Quote-strip the filename: it lands in a response header, and an unescaped
  // quote would let a crafted name inject header directives.
  const safeName = downloadFileName.replace(/["\\\r\n]/g, '').slice(0, 150);

  const command = new GetObjectCommand({
    Bucket: bucketFor('private'),
    Key: key,
    ResponseContentDisposition: `attachment; filename="${safeName}"`,
    // Force a download rather than inline rendering, so a stored HTML or SVG
    // payload can never execute in the context of a signed URL.
    ResponseContentType: 'application/octet-stream',
  });

  return getSignedUrl(s3(), command, {
    expiresIn: env.DOWNLOAD_URL_TTL_SECONDS,
  });
}

/** Public URL for an image. Only ever used for the public bucket. */
export function publicUrl(key: string): string {
  const host = process.env.NEXT_PUBLIC_MEDIA_HOST;
  if (!host) return `/api/media/${encodeURIComponent(key)}`;
  return `https://${host}/${key}`;
}

export async function deleteObject(
  key: string,
  bucket: 'public' | 'private'
): Promise<void> {
  try {
    await s3().send(
      new DeleteObjectCommand({ Bucket: bucketFor(bucket), Key: key })
    );
  } catch (error) {
    // A failed delete leaves an orphan object; it must not fail the user's
    // request. Surfaced for a cleanup job to reconcile.
    logger.error({ err: error, key, bucket }, 'failed to delete object');
  }
}
