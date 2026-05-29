import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
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
