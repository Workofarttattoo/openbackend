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
