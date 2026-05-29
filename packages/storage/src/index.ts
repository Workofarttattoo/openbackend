import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";

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
  #db: Database.Database;

  constructor(root: string, metadataPath: string) {
    this.#root = root;
    mkdirSync(root, { recursive: true });
    mkdirSync(dirname(metadataPath), { recursive: true });
    this.#db = new Database(metadataPath);
    this.#db.pragma("journal_mode = WAL");
    this.#migrate();
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

    this.#db
      .prepare(
        "insert into objects (id, name, path, size, content_type, created_at) values (?, ?, ?, ?, ?, ?)"
      )
      .run(object.id, object.name, object.path, object.size, object.contentType, object.createdAt);

    return object;
  }

  list(): StoredObject[] {
    return this.#db
      .prepare("select * from objects order by created_at desc")
      .all()
      .map(mapObject);
  }

  get(id: string): { object: StoredObject; data: Buffer } | null {
    const row = this.#db.prepare("select * from objects where id = ?").get(id);
    const object = row ? mapObject(row) : null;
    if (!object) {
      return null;
    }

    return {
      object,
      data: readFileSync(object.path)
    };
  }

  delete(id: string): StoredObject {
    const row = this.#db.prepare("select * from objects where id = ?").get(id);
    if (!row) {
      throw new Error(`File not found: ${id}`);
    }

    const object = mapObject(row);
    try {
      unlinkSync(object.path);
    } catch {
      // Metadata is the source of truth; tolerate an already-missing file.
    }

    this.#db.prepare("delete from objects where id = ?").run(id);
    return object;
  }

  exportMetadata(): unknown[] {
    return this.#db.prepare("select * from objects order by created_at desc").all();
  }

  #migrate(): void {
    this.#db.exec(`
      create table if not exists objects (
        id text primary key,
        name text not null,
        path text not null,
        size integer not null,
        content_type text not null,
        created_at text not null
      );
    `);
  }
}

export * from "./adapters.js";

function mapObject(row: unknown): StoredObject {
  const record = row as {
    id: string;
    name: string;
    path: string;
    size: number;
    content_type: string;
    created_at: string;
  };

  return {
    id: record.id,
    name: record.name,
    path: record.path,
    size: record.size,
    contentType: record.content_type,
    createdAt: record.created_at
  };
}
