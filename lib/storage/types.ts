/**
 * Storage seam for resume PDF bytes (User Story 1-4). Not a multi-provider interface
 * like `lib/email/provider.ts` — only Cloudflare R2 is in scope (research.md §2). This
 * type exists so `lib/resumes/service.ts` can accept an injected fake in tests, mirroring
 * how `lib/send/service.ts` accepts an optional `EmailProvider`.
 */

export type StoredObject = {
  body: ReadableStream<Uint8Array>;
  contentLength?: number;
};

export interface ResumeStorage {
  uploadObject(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Returns null if the object doesn't exist. */
  getObjectStream(key: string): Promise<StoredObject | null>;
  deleteObject(key: string): Promise<void>;
}
