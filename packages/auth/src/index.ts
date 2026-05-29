import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

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

export class AuthService {
  #users = new Map<string, Identity>();
  #sessions = new Map<string, Session>();
  #apiKeys = new Map<string, string>();

  createUser(email: string, password: string): Omit<Identity, "passwordHash"> {
    const normalized = email.trim().toLowerCase();
    if (this.#users.has(normalized)) {
      throw new Error("Email already exists");
    }

    const user = {
      id: randomUUID(),
      email: normalized,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };

    this.#users.set(normalized, user);
    return stripSecret(user);
  }

  login(email: string, password: string): Session {
    const user = this.#users.get(email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error("Invalid email or password");
    }

    const session = {
      token: randomBytes(32).toString("hex"),
      userId: user.id,
      createdAt: new Date().toISOString()
    };

    this.#sessions.set(session.token, session);
    return session;
  }

  logout(token: string): void {
    this.#sessions.delete(token);
  }

  listUsers(): Array<Omit<Identity, "passwordHash">> {
    return [...this.#users.values()].map(stripSecret);
  }

  createApiKey(label: string): { label: string; key: string } {
    const key = `ob_${randomBytes(24).toString("hex")}`;
    this.#apiKeys.set(key, label);
    return { label, key };
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

