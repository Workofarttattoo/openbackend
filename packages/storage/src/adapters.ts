import type { StoredObject } from "./index.js";

export type ObjectStorageAdapter = {
  put(input: { name: string; contentType?: string; data: Buffer }): StoredObject;
  list(): StoredObject[];
  get(id: string): { object: StoredObject; data: Buffer } | null;
  delete(id: string): StoredObject;
  exportMetadata(): unknown[];
};

export class S3CompatibleObjectStorage {
  constructor(_options: { endpoint: string; bucket: string; accessKeyId?: string; secretAccessKey?: string }) {
    throw new Error("S3-compatible storage adapter is not wired yet. Use filesystem storage for the current alpha.");
  }
}

