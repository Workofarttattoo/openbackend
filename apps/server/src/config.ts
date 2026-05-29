import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import type { AuthRole } from "@openbackend/auth";

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
  deploySize: "local" | "nas" | "vps";
  databaseDriver: "sqlite" | "postgres";
  storageDriver: "filesystem" | "minio";
  postgresUrl: string | null;
  s3Endpoint: string | null;
  s3Bucket: string;
  s3AccessKeyId: string | null;
  s3SecretAccessKey: string | null;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  functionTimeoutMs: number;
  requireRealtimeAuth: boolean;
  collectionPermissions: Record<string, CollectionPermission>;
};

export type CollectionPermission = {
  read?: AuthRole[];
  write?: AuthRole[];
};

export function loadConfig(env = process.env): ServerConfig {
  loadDotenv(env);
  const dataDir = resolve(env.OPENBACKEND_DATA_DIR ?? "data");

  return {
    host: env.OPENBACKEND_HOST ?? "127.0.0.1",
    port: Number(env.OPENBACKEND_PORT ?? "8787"),
    dataDir,
    publicUrl: env.OPENBACKEND_PUBLIC_URL ?? "http://localhost:8787",
    corsOrigins: splitList(env.OPENBACKEND_CORS_ORIGINS ?? "http://localhost:5173,http://localhost:5174,http://localhost:5175"),
    requireAuth: env.OPENBACKEND_REQUIRE_AUTH !== "false",
    requireWriteAuth: env.OPENBACKEND_REQUIRE_WRITE_AUTH !== "false",
    maxUploadBytes: Number(env.OPENBACKEND_MAX_UPLOAD_BYTES ?? "10485760"),
    backupDir: resolve(env.OPENBACKEND_BACKUP_DIR ?? "backups"),
    sessionTtlHours: Number(env.OPENBACKEND_SESSION_TTL_HOURS ?? "168"),
    deploySize: parseDeploySize(env.OPENBACKEND_DEPLOY_SIZE ?? "local"),
    databaseDriver: parseDatabaseDriver(env.OPENBACKEND_DATABASE ?? (env.OPENBACKEND_POSTGRES_URL ? "postgres" : "sqlite")),
    storageDriver: parseStorageDriver(env.OPENBACKEND_STORAGE ?? (env.OPENBACKEND_S3_ENDPOINT ? "minio" : "filesystem")),
    postgresUrl: env.OPENBACKEND_POSTGRES_URL || null,
    s3Endpoint: env.OPENBACKEND_S3_ENDPOINT || null,
    s3Bucket: env.OPENBACKEND_S3_BUCKET ?? "openbackend",
    s3AccessKeyId: env.OPENBACKEND_S3_ACCESS_KEY_ID ?? env.MINIO_ROOT_USER ?? null,
    s3SecretAccessKey: env.OPENBACKEND_S3_SECRET_ACCESS_KEY ?? env.MINIO_ROOT_PASSWORD ?? null,
    rateLimitWindowMs: Number(env.OPENBACKEND_RATE_LIMIT_WINDOW_MS ?? "60000"),
    rateLimitMax: Number(env.OPENBACKEND_RATE_LIMIT_MAX ?? "120"),
    functionTimeoutMs: Number(env.OPENBACKEND_FUNCTION_TIMEOUT_MS ?? "5000"),
    requireRealtimeAuth: env.OPENBACKEND_REQUIRE_REALTIME_AUTH !== "false",
    collectionPermissions: parseCollectionPermissions(env.OPENBACKEND_COLLECTION_PERMISSIONS ?? "{}")
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

function parseDeploySize(value: string): "local" | "nas" | "vps" {
  if (value === "nas" || value === "vps") {
    return value;
  }

  return "local";
}

function parseDatabaseDriver(value: string): "sqlite" | "postgres" {
  return value === "postgres" ? "postgres" : "sqlite";
}

function parseStorageDriver(value: string): "filesystem" | "minio" {
  return value === "minio" ? "minio" : "filesystem";
}

function parseCollectionPermissions(value: string): Record<string, CollectionPermission> {
  try {
    const parsed = JSON.parse(value) as Record<string, CollectionPermission>;
    return Object.fromEntries(
      Object.entries(parsed).map(([collection, permission]) => [
        collection,
        {
          read: normalizeRoles(permission.read),
          write: normalizeRoles(permission.write)
        }
      ])
    );
  } catch {
    return {};
  }
}

function normalizeRoles(roles: AuthRole[] | undefined): AuthRole[] | undefined {
  if (!roles) {
    return undefined;
  }

  return roles.filter((role) => ["admin", "editor", "viewer", "device"].includes(role));
}
