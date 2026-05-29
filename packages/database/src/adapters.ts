import type { DocumentChange, DocumentRecord } from "./index.js";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

export type MaybePromise<T> = T | Promise<T>;

export type DatabaseAdapter = {
  collections(): MaybePromise<string[]>;
  list<T = unknown>(collection: string): MaybePromise<DocumentRecord<T>[]>;
  get<T = unknown>(collection: string, id: string): MaybePromise<DocumentRecord<T> | null>;
  create<T = unknown>(collection: string, data: T, id?: string): MaybePromise<DocumentChange<T>>;
  update<T = unknown>(collection: string, id: string, patch: Partial<T>): MaybePromise<DocumentChange<T>>;
  delete(collection: string, id: string): MaybePromise<DocumentChange>;
  exportSnapshot(): MaybePromise<unknown>;
  importSnapshot(snapshot: { documents?: unknown[] }): MaybePromise<number>;
};

export class PostgresCollectionStore {
  #pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.#pool = pool;
  }

  static async connect(connectionString: string): Promise<PostgresCollectionStore> {
    const pool = new Pool({ connectionString });
    const store = new PostgresCollectionStore(pool);
    await store.migrate();
    return store;
  }

  async migrate(): Promise<void> {
    await this.#pool.query(`
      create table if not exists documents (
        id text not null,
        collection text not null,
        data jsonb not null,
        revision integer not null default 1,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        deleted_at timestamptz,
        primary key (collection, id)
      );

      create index if not exists idx_documents_collection_updated
      on documents (collection, updated_at);
    `);
  }

  async collections(): Promise<string[]> {
    const result = await this.#pool.query(
      "select distinct collection from documents where deleted_at is null order by collection"
    );
    return result.rows.map((row) => String(row.collection));
  }

  async list<T = unknown>(collection: string): Promise<DocumentRecord<T>[]> {
    const result = await this.#pool.query(
      "select * from documents where collection = $1 and deleted_at is null order by updated_at desc",
      [collection]
    );
    return result.rows.map((row) => mapPgRow<T>(row));
  }

  async get<T = unknown>(collection: string, id: string): Promise<DocumentRecord<T> | null> {
    const result = await this.#pool.query(
      "select * from documents where collection = $1 and id = $2 and deleted_at is null",
      [collection, id]
    );
    return result.rows[0] ? mapPgRow<T>(result.rows[0]) : null;
  }

  async create<T = unknown>(collection: string, data: T, id?: string): Promise<DocumentChange<T>> {
    const documentId = id ?? randomUUID();
    const now = new Date().toISOString();
    await this.#pool.query(
      `insert into documents (id, collection, data, revision, created_at, updated_at)
       values ($1, $2, $3, 1, $4, $5)`,
      [documentId, collection, JSON.stringify(data), now, now]
    );

    return {
      type: "created",
      document: await this.get<T>(collection, documentId) as DocumentRecord<T>
    };
  }

  async update<T = unknown>(collection: string, id: string, patch: Partial<T>): Promise<DocumentChange<T>> {
    const current = await this.get<Record<string, unknown>>(collection, id);
    if (!current) {
      throw new Error(`Document not found: ${collection}/${id}`);
    }

    const data = {
      ...current.data,
      ...patch
    };
    const updatedAt = new Date().toISOString();
    await this.#pool.query(
      "update documents set data = $1, revision = revision + 1, updated_at = $2 where collection = $3 and id = $4",
      [JSON.stringify(data), updatedAt, collection, id]
    );

    return {
      type: "updated",
      document: await this.get<T>(collection, id) as DocumentRecord<T>
    };
  }

  async delete(collection: string, id: string): Promise<DocumentChange> {
    const current = await this.get(collection, id);
    if (!current) {
      throw new Error(`Document not found: ${collection}/${id}`);
    }

    const deletedAt = new Date().toISOString();
    await this.#pool.query(
      "update documents set revision = revision + 1, updated_at = $1, deleted_at = $2 where collection = $3 and id = $4",
      [deletedAt, deletedAt, collection, id]
    );

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

  async exportSnapshot(): Promise<unknown> {
    const result = await this.#pool.query("select * from documents order by collection, id");
    return {
      exportedAt: new Date().toISOString(),
      documents: result.rows
    };
  }

  async importSnapshot(snapshot: { documents?: unknown[] }): Promise<number> {
    const client = await this.#pool.connect();
    const documents = snapshot.documents ?? [];
    try {
      await client.query("begin");
      for (const row of documents) {
        const record = row as {
          id: string;
          collection: string;
          data: string | unknown;
          revision?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          createdAt?: string;
          updatedAt?: string;
          deletedAt?: string | null;
        };
        const now = new Date().toISOString();
        await client.query(
          `insert into documents (id, collection, data, revision, created_at, updated_at, deleted_at)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict(collection, id) do update set
             data = excluded.data,
             revision = excluded.revision,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at`,
          [
            record.id,
            record.collection,
            typeof record.data === "string" ? record.data : JSON.stringify(record.data),
            record.revision ?? 1,
            record.created_at ?? record.createdAt ?? now,
            record.updated_at ?? record.updatedAt ?? now,
            record.deleted_at ?? record.deletedAt ?? null
          ]
        );
      }
      await client.query("commit");
      return documents.length;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

function mapPgRow<T>(row: {
  id: string;
  collection: string;
  data: T;
  revision: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}): DocumentRecord<T> {
  return {
    id: row.id,
    collection: row.collection,
    data: row.data,
    revision: row.revision,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null
  };
}
