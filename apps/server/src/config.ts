import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

export type ServerConfig = {
  host: string;
  port: number;
  dataDir: string;
  publicUrl: string;
  corsOrigins: string[];
  requireAuth: boolean;
  requireWriteAuth: boolean;
  maxUploadBytes: number;
  backupDir: string;
  sessionTtlHours: number;
};

export function loadConfig(env = process.env): ServerConfig {
  loadDotenv(env);
  const dataDir = resolve(env.OPENBACKEND_DATA_DIR ?? "data");

  return {
    host: env.OPENBACKEND_HOST ?? "127.0.0.1",
    port: Number(env.OPENBACKEND_PORT ?? "8787"),
    dataDir,
    publicUrl: env.OPENBACKEND_PUBLIC_URL ?? "http://localhost:8787",
    corsOrigins: splitList(env.OPENBACKEND_CORS_ORIGINS ?? "http://localhost:5173,http://localhost:5174"),
    requireAuth: env.OPENBACKEND_REQUIRE_AUTH !== "false",
    requireWriteAuth: env.OPENBACKEND_REQUIRE_WRITE_AUTH !== "false",
    maxUploadBytes: Number(env.OPENBACKEND_MAX_UPLOAD_BYTES ?? "10485760"),
    backupDir: resolve(env.OPENBACKEND_BACKUP_DIR ?? "backups"),
    sessionTtlHours: Number(env.OPENBACKEND_SESSION_TTL_HOURS ?? "168")
  };
}

function loadDotenv(env: NodeJS.ProcessEnv): void {
  const envPath = resolve(".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    env[key] ??= valueParts.join("=").replace(/^"|"$/g, "");
  }
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
