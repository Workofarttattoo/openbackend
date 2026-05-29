import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const profile = process.argv[2] ?? "local";
const profiles = {
  local: {
    port: 8878,
    composeProfiles: [],
    env: {
      OPENBACKEND_DEPLOY_SIZE: "local",
      OPENBACKEND_DATABASE: "sqlite",
      OPENBACKEND_STORAGE: "filesystem"
    },
    expect: {
      database: "sqlite",
      storage: "filesystem"
    }
  },
  nas: {
    port: 8879,
    composeProfiles: ["nas"],
    env: {
      OPENBACKEND_DEPLOY_SIZE: "nas",
      OPENBACKEND_DATABASE: "sqlite",
      OPENBACKEND_STORAGE: "minio",
      OPENBACKEND_S3_ENDPOINT: "http://minio:9000",
      OPENBACKEND_S3_BUCKET: "openbackend-smoke",
      OPENBACKEND_S3_ACCESS_KEY_ID: "openbackend",
      OPENBACKEND_S3_SECRET_ACCESS_KEY: "change-this-minio-password",
      MINIO_ROOT_USER: "openbackend",
      MINIO_ROOT_PASSWORD: "change-this-minio-password",
      MINIO_API_PORT: "9900",
      MINIO_CONSOLE_PORT: "9901"
    },
    expect: {
      database: "sqlite",
      storage: "minio"
    }
  },
  vps: {
    port: 8880,
    composeProfiles: ["vps"],
    env: {
      OPENBACKEND_DEPLOY_SIZE: "vps",
      OPENBACKEND_DATABASE: "postgres",
      OPENBACKEND_STORAGE: "minio",
      OPENBACKEND_POSTGRES_URL: "postgres://openbackend:change-this-postgres-password@postgres:5432/openbackend",
      OPENBACKEND_S3_ENDPOINT: "http://minio:9000",
      OPENBACKEND_S3_BUCKET: "openbackend-smoke",
      OPENBACKEND_S3_ACCESS_KEY_ID: "openbackend",
      OPENBACKEND_S3_SECRET_ACCESS_KEY: "change-this-minio-password",
      POSTGRES_DB: "openbackend",
      POSTGRES_USER: "openbackend",
      POSTGRES_PASSWORD: "change-this-postgres-password",
      POSTGRES_PORT: "9942",
      MINIO_ROOT_USER: "openbackend",
      MINIO_ROOT_PASSWORD: "change-this-minio-password",
      MINIO_API_PORT: "9910",
      MINIO_CONSOLE_PORT: "9911"
    },
    expect: {
      database: "postgres",
      storage: "minio"
    }
  }
};

const selected = profiles[profile];
if (!selected) {
  console.error("[error] Usage: node scripts/smoke-docker-profile.js local|nas|vps");
  process.exit(1);
}

const project = `openbackend-smoke-${profile}`;
const dataDir = mkdtempSync(join(tmpdir(), `${project}-data-`));
const baseUrl = `http://127.0.0.1:${selected.port}`;
const env = {
  ...process.env,
  ...selected.env,
  COMPOSE_PROJECT_NAME: project,
  OPENBACKEND_PORT: String(selected.port),
  OPENBACKEND_HOST_DATA_DIR: dataDir,
  OPENBACKEND_REQUIRE_AUTH: "true",
  OPENBACKEND_REQUIRE_WRITE_AUTH: "true",
  OPENBACKEND_REQUIRE_REALTIME_AUTH: "false",
  OPENBACKEND_COLLECTION_PERMISSIONS: "{}"
};

try {
  compose(["down", "--remove-orphans", "--volumes"], env, false);
  compose([...profileArgs(selected.composeProfiles), "up", "--build", "-d", "--wait"], env, true);
  await waitForHealth(baseUrl, selected.expect);
  await exerciseBackend(baseUrl);
  console.log(`[info] Docker ${profile} smoke passed`);
} finally {
  compose(["down", "--remove-orphans", "--volumes"], env, false);
  rmSync(dataDir, { recursive: true, force: true });
}

function profileArgs(composeProfiles) {
  return composeProfiles.flatMap((name) => ["--profile", name]);
}

function compose(args, env, required) {
  const result = spawnSync("docker", ["compose", ...args], {
    env,
    stdio: "inherit"
  });

  if (required && result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function waitForHealth(baseUrl, expect) {
  const deadline = Date.now() + 90000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        const health = await response.json();
        assertEqual(health.database, expect.database, "database driver");
        assertEqual(health.storage, expect.storage, "storage driver");
        return;
      }
      lastError = await response.text();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${baseUrl}/health: ${lastError}`);
}

async function exerciseBackend(baseUrl) {
  const bootstrap = await post(baseUrl, "/api/auth/bootstrap", {
    email: "owner@example.local",
    password: "change-me-now"
  });
  const token = bootstrap.session.token;

  const created = await post(baseUrl, "/api/collections/smoke/documents", {
    data: {
      ok: true,
      profile
    }
  }, token);
  assertEqual(created.data.profile, profile, "created profile");

  const documents = await get(baseUrl, "/api/collections/smoke/documents", token);
  assertEqual(documents.length, 1, "document count");

  const file = await post(baseUrl, "/api/files", {
    name: "smoke.txt",
    data: `hello-${profile}`,
    encoding: "utf8",
    contentType: "text/plain"
  }, token);
  assertEqual(file.name, "smoke.txt", "file name");

  const files = await get(baseUrl, "/api/files", token);
  assertEqual(files.length, 1, "file count");

  const exported = await get(baseUrl, "/api/admin/export", token);
  if (!exported.database?.documents || !exported.storage?.objects) {
    throw new Error("Export did not include database documents and storage objects");
  }
}

async function get(baseUrl, path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

async function post(baseUrl, path, body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}
