import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

loadDotenv();

const dataDir = resolve(process.env.OPENBACKEND_DATA_DIR ?? "data");
const backupRoot = resolve(process.env.OPENBACKEND_BACKUP_DIR ?? "backups");
const requestedBackup = process.argv[2];
const backupDir = requestedBackup ? resolve(requestedBackup) : latestBackup(backupRoot);

if (!backupDir || !existsSync(backupDir)) {
  console.error("[error] Backup directory not found. Pass a backup path or set OPENBACKEND_BACKUP_DIR.");
  process.exit(1);
}

mkdirSync(dataDir, { recursive: true });

for (const name of ["openbackend.sqlite", "auth.sqlite", "storage.sqlite"]) {
  restoreIfExists(join(backupDir, name), join(dataDir, name));
  restoreIfExists(join(backupDir, `${name}-wal`), join(dataDir, `${name}-wal`));
  restoreIfExists(join(backupDir, `${name}-shm`), join(dataDir, `${name}-shm`));
}

restoreIfExists(join(backupDir, "files"), join(dataDir, "files"), true);

if ((process.env.OPENBACKEND_DATABASE ?? "sqlite") === "postgres" && process.env.OPENBACKEND_POSTGRES_URL) {
  await restorePostgres(backupDir);
}

if ((process.env.OPENBACKEND_STORAGE ?? "filesystem") === "minio" && process.env.OPENBACKEND_S3_ENDPOINT) {
  await restoreMinio(backupDir);
}

console.log(`[info] Restored backup from ${backupDir}`);

function latestBackup(root) {
  if (!existsSync(root)) {
    return null;
  }

  const entries = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return entries.length ? join(root, entries.at(-1)) : null;
}

function restoreIfExists(source, target, replaceDirectory = false) {
  if (!existsSync(source)) {
    return;
  }

  if (replaceDirectory && existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }

  cpSync(source, target, { recursive: true });
  console.log(`[info] Restored ${source}`);
}

function loadDotenv() {
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
    process.env[key] ??= valueParts.join("=").replace(/^"|"$/g, "");
  }
}

async function restorePostgres(backupDir) {
  const source = join(backupDir, "postgres-documents.json");
  if (!existsSync(source)) {
    return;
  }

  const pg = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.OPENBACKEND_POSTGRES_URL });
  const snapshot = JSON.parse(readFileSync(source, "utf8"));
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`
      create table if not exists documents (
        id text not null,
        collection text not null,
        data jsonb not null,
        revision integer not null default 1,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        deleted_at timestamptz,
        primary key (collection, id)
      )
    `);
    for (const record of snapshot.documents ?? []) {
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
          JSON.stringify(record.data),
          record.revision ?? 1,
          record.created_at ?? record.createdAt ?? new Date().toISOString(),
          record.updated_at ?? record.updatedAt ?? new Date().toISOString(),
          record.deleted_at ?? record.deletedAt ?? null
        ]
      );
    }
    await client.query("commit");
    console.log("[info] Restored PostgreSQL documents");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function restoreMinio(backupDir) {
  const sourceDir = join(backupDir, "minio");
  if (!existsSync(sourceDir)) {
    return;
  }

  const { Client } = await import("minio");
  const bucket = process.env.OPENBACKEND_S3_BUCKET ?? "openbackend";
  const client = createMinioClient(Client);
  if (!(await client.bucketExists(bucket))) {
    await client.makeBucket(bucket);
  }

  for (const entry of readdirSync(sourceDir)) {
    const objectName = decodeURIComponent(entry);
    const data = readFileSync(join(sourceDir, entry));
    await client.putObject(bucket, objectName, data, data.byteLength);
  }

  console.log("[info] Restored MinIO bucket objects");
}

function createMinioClient(Client) {
  const endpoint = new URL(process.env.OPENBACKEND_S3_ENDPOINT);
  return new Client({
    endPoint: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : (endpoint.protocol === "https:" ? 443 : 80),
    useSSL: endpoint.protocol === "https:",
    accessKey: process.env.OPENBACKEND_S3_ACCESS_KEY_ID ?? process.env.MINIO_ROOT_USER ?? "openbackend",
    secretKey: process.env.OPENBACKEND_S3_SECRET_ACCESS_KEY ?? process.env.MINIO_ROOT_PASSWORD ?? "change-this-minio-password"
  });
}
