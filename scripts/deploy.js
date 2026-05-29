import { spawnSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const allowedSizes = new Set(["local", "nas", "vps"]);
const requestedSize = process.argv[2] ?? process.env.OPENBACKEND_DEPLOY_SIZE ?? "local";

if (!allowedSizes.has(requestedSize)) {
  console.error("[error] Usage: npm run deploy -- local|nas|vps");
  process.exit(1);
}

ensureEnvFile();
ensureDocker();

const env = {
  ...process.env,
  OPENBACKEND_DEPLOY_SIZE: requestedSize
};

if (requestedSize === "nas" || requestedSize === "vps") {
  env.OPENBACKEND_STORAGE ??= "minio";
  env.OPENBACKEND_S3_ENDPOINT ??= "http://minio:9000";
  env.OPENBACKEND_S3_BUCKET ??= "openbackend";
}

if (requestedSize === "vps") {
  env.OPENBACKEND_DATABASE ??= "postgres";
  env.OPENBACKEND_POSTGRES_URL ??= "postgres://openbackend:change-this-postgres-password@postgres:5432/openbackend";
}

const args = ["compose"];
if (requestedSize !== "local") {
  args.push("--profile", requestedSize);
}
args.push("up", "--build", "-d");

run("docker", args, env);

console.log(`[info] OpenBackend ${requestedSize} deployment is starting.`);
console.log("[info] Server: http://localhost:8787");
console.log("[info] Check status with: docker compose ps");

function ensureEnvFile() {
  const envPath = resolve(".env");
  if (existsSync(envPath)) {
    return;
  }

  copyFileSync(resolve(".env.example"), envPath);
  console.log("[info] Created .env from .env.example");
}

function ensureDocker() {
  const result = spawnSync("docker", ["compose", "version"], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    console.error("[error] Docker Compose is required for one-button deploy.");
    console.error("[error] Install Docker Desktop or Docker Engine with the compose plugin, then retry.");
    process.exit(result.status ?? 1);
  }
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
