import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";

export type StoredObject = {
  id: string;
  name: string;
  path: string;
  size: number;
  contentType: string;
  createdAt: string;
};

export class LocalObjectStorage {
  #root: string;
  #objects = new Map<string, StoredObject>();

  constructor(root: string) {
    this.#root = root;
    mkdirSync(root, { recursive: true });
  }

  put(input: { name: string; contentType?: string; data: Buffer }): StoredObject {
    const id = randomUUID();
    const safeName = basename(input.name).replaceAll(" ", "-");
    const path = join(this.#root, `${id}-${safeName}`);

    writeFileSync(path, input.data);

    const object = {
      id,
      name: input.name,
      path,
      size: input.data.byteLength,
      contentType: input.contentType ?? "application/octet-stream",
      createdAt: new Date().toISOString()
    };

    this.#objects.set(id, object);
    return object;
  }

  list(): StoredObject[] {
    return [...this.#objects.values()];
  }

  get(id: string): { object: StoredObject; data: Buffer } | null {
    const object = this.#objects.get(id);
    if (!object) {
      return null;
    }

    return {
      object,
      data: readFileSync(object.path)
    };
  }
}
