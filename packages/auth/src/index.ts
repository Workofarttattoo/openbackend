import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export type Identity = {
  id: string;
  email: string;
  role: AuthRole;
  passwordHash: string;
  createdAt: string;
};

export type Session = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type ApiKeyRecord = {
  key: string;
  label: string;
  role: AuthRole;
  createdAt: string;
};

export type AuthRole = "admin" | "editor" | "viewer" | "device";

export type Principal = {
  type: "session" | "apiKey";
  id: string;
  role: AuthRole;
};

export class AuthService {
  #db: Database.Database;
  #sessionTtlMs: number;

  constructor(filePath: string, options: { sessionTtlMs?: number } = {}) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.#db = new Database(filePath);
    this.#sessionTtlMs = options.sessionTtlMs ?? 7 * 24 * 60 * 60 * 1000;
    this.#db.pragma("journal_mode = WAL");
    this.#migrate();
  }

  createUser(email: string, password: string, role: AuthRole = "editor"): Omit<Identity, "passwordHash"> {
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
      role,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };

    this.#db
      .prepare("insert into identities (id, email, role, password_hash, created_at) values (?, ?, ?, ?, ?)")
      .run(user.id, user.email, user.role, user.passwordHash, user.createdAt);

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
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.#sessionTtlMs).toISOString()
    };

    this.#db
      .prepare("insert into sessions (token, user_id, created_at, expires_at) values (?, ?, ?, ?)")
      .run(session.token, session.userId, session.createdAt, session.expiresAt);

    return session;
  }

  logout(token: string): void {
    this.#db.prepare("delete from sessions where token = ?").run(token);
  }

  getSession(token: string): Session | null {
    const row = this.#db.prepare("select * from sessions where token = ?").get(token);
    const session = row ? mapSession(row) : null;
    if (!session) {
      return null;
    }

    if (Date.parse(session.expiresAt) <= Date.now()) {
      this.logout(session.token);
      return null;
    }

    return session;
  }

  getPrincipalFromSession(token: string): Principal | null {
    const session = this.getSession(token);
    if (!session) {
      return null;
    }

    const row = this.#db.prepare("select id, role from identities where id = ?").get(session.userId);
    if (!row) {
      return null;
    }

    const record = row as { id: string; role: AuthRole };
    return {
      type: "session",
      id: record.id,
      role: record.role
    };
  }

  listUsers(): Array<Omit<Identity, "passwordHash">> {
    return this.#db
      .prepare("select * from identities order by created_at desc")
      .all()
      .map((row) => stripSecret(mapIdentity(row)));
  }

  createApiKey(label: string, role: AuthRole = "device"): { label: string; key: string; role: AuthRole } {
    const key = `ob_${randomBytes(24).toString("hex")}`;
    this.#db
      .prepare("insert into api_keys (key, label, role, created_at) values (?, ?, ?, ?)")
      .run(key, label, role, new Date().toISOString());

    return { label, key, role };
  }

  validateApiKey(key: string): boolean {
    return Boolean(this.#db.prepare("select key from api_keys where key = ?").get(key));
  }

  getPrincipalFromApiKey(key: string): Principal | null {
    const row = this.#db.prepare("select key, role from api_keys where key = ?").get(key);
    if (!row) {
      return null;
    }

    const record = row as { key: string; role: AuthRole };
    return {
      type: "apiKey",
      id: record.key,
      role: record.role
    };
  }

  listApiKeys(): Array<Omit<ApiKeyRecord, "key">> {
    return this.#db
      .prepare("select label, role, created_at from api_keys order by created_at desc")
      .all()
      .map((row) => {
        const record = row as { label: string; role: AuthRole; created_at: string };
        return {
          label: record.label,
          role: record.role,
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
        role text not null default 'editor',
        password_hash text not null,
        created_at text not null
      );

      create table if not exists sessions (
        token text primary key,
        user_id text not null references identities(id) on delete cascade,
        created_at text not null,
        expires_at text not null
      );

      create table if not exists api_keys (
        key text primary key,
        label text not null,
        role text not null default 'device',
        created_at text not null
      );
    `);

    const identityColumns = this.#db.prepare("pragma table_info(identities)").all() as Array<{ name: string }>;
    if (!identityColumns.some((column) => column.name === "role")) {
      this.#db.exec("alter table identities add column role text not null default 'editor'");
    }

    const sessionColumns = this.#db.prepare("pragma table_info(sessions)").all() as Array<{ name: string }>;
    if (!sessionColumns.some((column) => column.name === "expires_at")) {
      const expiresAt = new Date(Date.now() + this.#sessionTtlMs).toISOString();
      this.#db.exec(`alter table sessions add column expires_at text not null default '${expiresAt}'`);
    }

    const apiKeyColumns = this.#db.prepare("pragma table_info(api_keys)").all() as Array<{ name: string }>;
    if (!apiKeyColumns.some((column) => column.name === "role")) {
      this.#db.exec("alter table api_keys add column role text not null default 'device'");
    }
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
    role: user.role,
    createdAt: user.createdAt
  };
}

function mapIdentity(row: unknown): Identity {
  const record = row as {
    id: string;
    email: string;
    role: AuthRole;
    password_hash: string;
    created_at: string;
  };

  return {
    id: record.id,
    email: record.email,
    role: record.role,
    passwordHash: record.password_hash,
    createdAt: record.created_at
  };
}

function mapSession(row: unknown): Session {
  const record = row as {
    token: string;
    user_id: string;
    created_at: string;
    expires_at: string;
  };

  return {
    token: record.token,
    userId: record.user_id,
    createdAt: record.created_at,
    expiresAt: record.expires_at
  };
}
