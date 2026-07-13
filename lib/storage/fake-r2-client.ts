import type { ResumeStorage, StoredObject } from "./types";

/**
 * In-memory fake of `ResumeStorage` for unit/integration tests (mirrors
 * `lib/email/fake-provider.ts`). Records every stored object so a test can assert on
 * uploads/deletes without a network call to R2.
 */
export class FakeResumeStorage implements ResumeStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  async uploadObject(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async getObjectStream(key: string): Promise<StoredObject | null> {
    const stored = this.objects.get(key);
    if (!stored) return null;
    const { body } = stored;
    return {
      contentLength: body.byteLength,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(body));
          controller.close();
        },
      }),
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
