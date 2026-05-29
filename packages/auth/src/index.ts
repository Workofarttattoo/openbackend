import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export type Identity = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type Session = {
  token: string;
  userId: string;
  createdAt: string;
};

export type ApiKeyRecord = {
  key: string;
  label: string;
  createdAt: string;
};

export class AuthService {
  #db: Database.Database;

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.#db = new Database(filePath);
    this.#db.pragma("journal_mode = WAL");
    this.#migrate();
  }

  createUser(email: string, password: string): Omit<Identity, "passwordHash"> {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) {
      throw new Error("Email address is invalid");
    }

    if (password.length < 10) {
      throw new Error("Password must be at least 10 characters");
    }

    if (this.#findUserByEmail(normalized)) {
      throw new Error("Email already exists");
    }

    const user = {
      id: randomUUID(),
      email: normalized,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };

    this.#db
      .prepare("insert into identities (id, email, password_hash, created_at) values (?, ?, ?, ?)")
      .run(user.id, user.email, user.passwordHash, user.createdAt);

    return stripSecret(user);
  }

  login(email: string, password: string): Session {
    const user = this.#findUserByEmail(email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error("Invalid email or password");
    }

    const session = {
      token: randomBytes(32).toString("hex"),
      userId: user.id,
      createdAt: new Date().toISOString()
    };

    this.#db
      .prepare("insert into sessions (token, user_id, created_at) values (?, ?, ?)")
      .run(session.token, session.userId, session.createdAt);

    return session;
  }

  logout(token: string): void {
    this.#db.prepare("delete from sessions where token = ?").run(token);
  }

  getSession(token: string): Session | null {
    const row = this.#db.prepare("select * from sessions where token = ?").get(token);
    return row ? mapSession(row) : null;
  }

  listUsers(): Array<Omit<Identity, "passwordHash">> {
    return this.#db
      .prepare("select * from identities order by created_at desc")
      .all()
      .map((row) => stripSecret(mapIdentity(row)));
  }

  createApiKey(label: string): { label: string; key: string } {
    const key = `ob_${randomBytes(24).toString("hex")}`;
    this.#db
      .prepare("insert into api_keys (key, label, created_at) values (?, ?, ?)")
      .run(key, label, new Date().toISOString());

    return { label, key };
  }

  validateApiKey(key: string): boolean {
    return Boolean(this.#db.prepare("select key from api_keys where key = ?").get(key));
  }

  listApiKeys(): Array<Omit<ApiKeyRecord, "key">> {
    return this.#db
      .prepare("select label, created_at from api_keys order by created_at desc")
      .all()
      .map((row) => {
        const record = row as { label: string; created_at: string };
        return {
          label: record.label,
          createdAt: record.created_at
        };
      });
  }

  userCount(): number {
    const row = this.#db.prepare("select count(*) as count from identities").get() as { count: number };
    return row.count;
  }

  #findUserByEmail(email: string): Identity | null {
    const row = this.#db.prepare("select * from identities where email = ?").get(email);
    return row ? mapIdentity(row) : null;
  }

  #migrate(): void {
    this.#db.exec(`
      create table if not exists identities (
        id text primary key,
        email text not null unique,
        password_hash text not null,
        created_at text not null
      );

      create table if not exists sessions (
        token text primary key,
        user_id text not null references identities(id) on delete cascade,
        created_at text not null
      );

      create table if not exists api_keys (
        key text primary key,
        label text not null,
        created_at text not null
      );
    `);
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [salt, hash] = encoded.split(":");
  const candidate = pbkdf2Sync(password, salt, 120000, 32, "sha256");
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

function stripSecret(user: Identity): Omit<Identity, "passwordHash"> {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt
  };
}

function mapIdentity(row: unknown): Identity {
  const record = row as {
    id: string;
    email: string;
    password_hash: string;
    created_at: string;
  };

  return {
    id: record.id,
    email: record.email,
    passwordHash: record.password_hash,
    createdAt: record.created_at
  };
}

function mapSession(row: unknown): Session {
  const record = row as {
    token: string;
    user_id: string;
    created_at: string;
  };

  return {
    token: record.token,
    userId: record.user_id,
    createdAt: record.created_at
  };
}
