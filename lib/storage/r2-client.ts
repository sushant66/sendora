import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  NoSuchKey,
} from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/validation/env";
import type { ResumeStorage, StoredObject } from "./types";

/**
 * Thin wrapper over an S3-compatible client, configured for Cloudflare R2 (research.md
 * §1). Not a multi-provider seam: `lib/resumes/service.ts` is the only caller, and a
 * future feature depends on that service's `getResumeFile`, never on this module.
 */

let client: S3Client | null = null;

function r2(): S3Client {
  if (client) return client;
  const env = getEnv();
  client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

function bucket(): string {
  return getEnv().R2_BUCKET_NAME;
}

export async function uploadObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

/** Returns null if the object doesn't exist (caller maps this to a NotFoundError). */
export async function getObjectStream(key: string): Promise<StoredObject | null> {
  try {
    const result = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    if (!result.Body) return null;
    return {
      body: result.Body.transformToWebStream(),
      contentLength: result.ContentLength,
    };
  } catch (err) {
    if (err instanceof NoSuchKey) return null;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export const r2Storage: ResumeStorage = { uploadObject, getObjectStream, deleteObject };
