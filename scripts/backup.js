import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

loadDotenv();

const dataDir = resolve(process.env.OPENBACKEND_DATA_DIR ?? "data");
const backupRoot = resolve(process.env.OPENBACKEND_BACKUP_DIR ?? "backups");
const timestamp = new Date().toISOString().replaceAll(":", "-");
const destination = join(backupRoot, timestamp);

mkdirSync(destination, { recursive: true });

for (const name of ["openbackend.sqlite", "auth.sqlite", "storage.sqlite"]) {
  copyIfExists(join(dataDir, name), join(destination, name));
  copyIfExists(join(dataDir, `${name}-wal`), join(destination, `${name}-wal`));
  copyIfExists(join(dataDir, `${name}-shm`), join(destination, `${name}-shm`));
}

copyIfExists(join(dataDir, "files"), join(destination, "files"));

if ((process.env.OPENBACKEND_DATABASE ?? "sqlite") === "postgres" && process.env.OPENBACKEND_POSTGRES_URL) {
  await backupPostgres(destination);
}

if ((process.env.OPENBACKEND_STORAGE ?? "filesystem") === "minio" && process.env.OPENBACKEND_S3_ENDPOINT) {
  await backupMinio(destination);
}

console.log(`[info] Backup written to ${destination}`);

function copyIfExists(source, target) {
  if (!existsSync(source)) {
    return;
  }

  cpSync(source, target, { recursive: true });
  console.log(`[info] Copied ${basename(source)}`);
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

async function backupPostgres(destination) {
  const pg = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.OPENBACKEND_POSTGRES_URL });
  try {
    const documents = await pool.query("select * from documents order by collection, id");
    writeFileSync(
      join(destination, "postgres-documents.json"),
      JSON.stringify({ exportedAt: new Date().toISOString(), documents: documents.rows }, null, 2)
    );
    console.log("[info] Exported PostgreSQL documents");
  } finally {
    await pool.end();
  }
}

async function backupMinio(destination) {
  const { Client } = await import("minio");
  const bucket = process.env.OPENBACKEND_S3_BUCKET ?? "openbackend";
  const client = createMinioClient(Client);
  const minioDir = join(destination, "minio");
  mkdirSync(minioDir, { recursive: true });

  const stream = client.listObjectsV2(bucket, "", true);
  for await (const item of stream) {
    if (!item.name) {
      continue;
    }

    const data = await readMinioObject(client, bucket, item.name);
    const target = join(minioDir, encodeURIComponent(item.name));
    writeFileSync(target, data);
  }

  console.log("[info] Mirrored MinIO bucket objects");
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

async function readMinioObject(client, bucket, name) {
  const stream = await client.getObject(bucket, name);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
