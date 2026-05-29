import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export type DocumentRecord<T = unknown> = {
  id: string;
  collection: string;
  data: T;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type DocumentChange<T = unknown> = {
  type: "created" | "updated" | "deleted";
  document: DocumentRecord<T>;
};

export class CollectionStore {
  #db: Database.Database;

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.#db = new Database(filePath);
    this.#db.pragma("journal_mode = WAL");
    this.#db.pragma("foreign_keys = ON");
    this.#migrate();
  }

  collections(): string[] {
    return this.#db
      .prepare("select distinct collection from documents where deleted_at is null order by collection")
      .all()
      .map((row) => String((row as { collection: string }).collection));
  }

  list<T = unknown>(collection: string): DocumentRecord<T>[] {
    return this.#db
      .prepare("select * from documents where collection = ? and deleted_at is null order by updated_at desc")
      .all(collection)
      .map((row) => this.#mapRow<T>(row));
  }

  get<T = unknown>(collection: string, id: string): DocumentRecord<T> | null {
    const row = this.#db
      .prepare("select * from documents where collection = ? and id = ? and deleted_at is null")
      .get(collection, id);

    return row ? this.#mapRow<T>(row) : null;
  }

  create<T = unknown>(collection: string, data: T, id?: string): DocumentChange<T> {
    const documentId = id ?? randomUUID();
    const now = new Date().toISOString();
    this.#db
      .prepare(
        "insert into documents (id, collection, data, revision, created_at, updated_at) values (?, ?, ?, 1, ?, ?)"
      )
      .run(documentId, collection, JSON.stringify(data), now, now);

    return {
      type: "created",
      document: this.get<T>(collection, documentId) as DocumentRecord<T>
    };
  }

  update<T = unknown>(collection: string, id: string, patch: Partial<T>): DocumentChange<T> {
    const current = this.get<Record<string, unknown>>(collection, id);
    if (!current) {
      throw new Error(`Document not found: ${collection}/${id}`);
    }

    const data = {
      ...current.data,
      ...patch
    };
    const updatedAt = new Date().toISOString();

    this.#db
      .prepare(
        "update documents set data = ?, revision = revision + 1, updated_at = ? where collection = ? and id = ?"
      )
      .run(JSON.stringify(data), updatedAt, collection, id);

    return {
      type: "updated",
      document: this.get<T>(collection, id) as DocumentRecord<T>
    };
  }

  delete(collection: string, id: string): DocumentChange {
    const current = this.get(collection, id);
    if (!current) {
      throw new Error(`Document not found: ${collection}/${id}`);
    }

    const deletedAt = new Date().toISOString();
    this.#db
      .prepare(
        "update documents set revision = revision + 1, updated_at = ?, deleted_at = ? where collection = ? and id = ?"
      )
      .run(deletedAt, deletedAt, collection, id);

    return {
      type: "deleted",
      document: {
        ...current,
        revision: current.revision + 1,
        updatedAt: deletedAt,
        deletedAt
      }
    };
  }

  exportSnapshot(): unknown {
    return {
      exportedAt: new Date().toISOString(),
      documents: this.#db.prepare("select * from documents order by collection, id").all()
    };
  }

  #migrate(): void {
    this.#db.exec(`
      create table if not exists documents (
        id text not null,
        collection text not null,
        data text not null,
        revision integer not null default 1,
        created_at text not null,
        updated_at text not null,
        deleted_at text,
        primary key (collection, id)
      );

      create index if not exists idx_documents_collection_updated
      on documents (collection, updated_at);
    `);
  }

  #mapRow<T>(row: unknown): DocumentRecord<T> {
    const record = row as {
      id: string;
      collection: string;
      data: string;
      revision: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    };

    return {
      id: record.id,
      collection: record.collection,
      data: JSON.parse(record.data) as T,
      revision: record.revision,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      deletedAt: record.deleted_at
    };
  }
}
