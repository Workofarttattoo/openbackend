import type { StoredObject } from "./index.js";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "minio";

export type MaybePromise<T> = T | Promise<T>;

export type ObjectStorageAdapter = {
  put(input: { name: string; contentType?: string; data: Buffer }): MaybePromise<StoredObject>;
  list(): MaybePromise<StoredObject[]>;
  get(id: string): MaybePromise<{ object: StoredObject; data: Buffer } | null>;
  delete(id: string): MaybePromise<StoredObject>;
  exportMetadata(): MaybePromise<unknown[]>;
};

export class S3CompatibleObjectStorage {
  #client: Client;
  #bucket: string;

  constructor(options: {
    endpoint: string;
    bucket: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    useSSL?: boolean;
  }) {
    const url = new URL(options.endpoint);
    this.#bucket = options.bucket;
    this.#client = new Client({
      endPoint: url.hostname,
      port: url.port ? Number(url.port) : (url.protocol === "https:" ? 443 : 80),
      useSSL: options.useSSL ?? url.protocol === "https:",
      accessKey: options.accessKeyId ?? "openbackend",
      secretKey: options.secretAccessKey ?? "change-this-minio-password"
    });
  }

  static async connect(options: {
    endpoint: string;
    bucket: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    useSSL?: boolean;
  }): Promise<S3CompatibleObjectStorage> {
    const storage = new S3CompatibleObjectStorage(options);
    await storage.#ensureBucket();
    return storage;
  }

  async put(input: { name: string; contentType?: string; data: Buffer }): Promise<StoredObject> {
    const id = randomUUID();
    const safeName = basename(input.name).replaceAll(" ", "-");
    const object = {
      id,
      name: input.name,
      path: `objects/${id}-${safeName}`,
      size: input.data.byteLength,
      contentType: input.contentType ?? "application/octet-stream",
      createdAt: new Date().toISOString()
    };

    await this.#client.putObject(this.#bucket, object.path, input.data, input.data.byteLength, {
      "content-type": object.contentType
    });
    await this.#writeMetadata(object);
    return object;
  }

  async list(): Promise<StoredObject[]> {
    const objects = await this.#listMetadataObjects();
    const records = await Promise.all(objects.map((name) => this.#readMetadata(name)));
    return records.filter((record): record is StoredObject => Boolean(record));
  }

  async get(id: string): Promise<{ object: StoredObject; data: Buffer } | null> {
    const object = await this.#readMetadata(this.#metadataPath(id));
    if (!object) {
      return null;
    }

    const stream = await this.#client.getObject(this.#bucket, object.path);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return {
      object,
      data: Buffer.concat(chunks)
    };
  }

  async delete(id: string): Promise<StoredObject> {
    const object = await this.#readMetadata(this.#metadataPath(id));
    if (!object) {
      throw new Error(`File not found: ${id}`);
    }

    await this.#client.removeObject(this.#bucket, object.path);
    await this.#client.removeObject(this.#bucket, this.#metadataPath(id));
    return object;
  }

  async exportMetadata(): Promise<unknown[]> {
    return this.list();
  }

  async #ensureBucket(): Promise<void> {
    const exists = await this.#client.bucketExists(this.#bucket);
    if (!exists) {
      await this.#client.makeBucket(this.#bucket);
    }
  }

  async #writeMetadata(object: StoredObject): Promise<void> {
    const data = Buffer.from(JSON.stringify(object), "utf8");
    await this.#client.putObject(this.#bucket, this.#metadataPath(object.id), data, data.byteLength, {
      "content-type": "application/json"
    });
  }

  async #readMetadata(path: string): Promise<StoredObject | null> {
    try {
      const stream = await this.#client.getObject(this.#bucket, path);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as StoredObject;
    } catch {
      return null;
    }
  }

  async #listMetadataObjects(): Promise<string[]> {
    const stream = this.#client.listObjectsV2(this.#bucket, ".openbackend/objects/", true);
    const names: string[] = [];
    for await (const item of stream) {
      if (item.name) {
        names.push(item.name);
      }
    }

    return names.sort();
  }

  #metadataPath(id: string): string {
    return `.openbackend/objects/${id}.json`;
  }
}
