import type { DocumentChange, DocumentRecord } from "./index.js";

export type DatabaseAdapter = {
  collections(): string[];
  list<T = unknown>(collection: string): DocumentRecord<T>[];
  get<T = unknown>(collection: string, id: string): DocumentRecord<T> | null;
  create<T = unknown>(collection: string, data: T, id?: string): DocumentChange<T>;
  update<T = unknown>(collection: string, id: string, patch: Partial<T>): DocumentChange<T>;
  delete(collection: string, id: string): DocumentChange;
  exportSnapshot(): unknown;
  importSnapshot(snapshot: { documents?: unknown[] }): number;
};

export class PostgresCollectionStore {
  constructor(_connectionString: string) {
    throw new Error("PostgreSQL adapter is not wired yet. Use SQLite local mode for the current alpha.");
  }
}

