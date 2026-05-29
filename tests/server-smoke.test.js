import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import WebSocket from "ws";

const port = 8791;
const baseUrl = `http://127.0.0.1:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "openbackend-smoke-"));
let server;
let token;

describe("server deploy smoke", () => {
  before(async () => {
    server = spawn("npm", ["run", "dev"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPENBACKEND_PORT: String(port),
        OPENBACKEND_DATA_DIR: dataDir,
        OPENBACKEND_REQUIRE_AUTH: "true"
      },
      stdio: "ignore"
    });

    await waitForHealth();
  });

  after(() => {
    server?.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("bootstraps an admin and protects admin routes", async () => {
    const denied = await fetch(`${baseUrl}/api/admin/auth/users`);
    assert.equal(denied.status, 401);

    const bootstrap = await post("/api/auth/bootstrap", {
      email: "owner@example.local",
      password: "change-me-now"
    });

    token = bootstrap.session.token;
    assert.equal(bootstrap.user.email, "owner@example.local");

    const users = await get("/api/admin/auth/users", token);
    assert.equal(users.length, 1);
    assert.equal(users[0].role, "admin");
  });

  it("persists files, creates API keys, and exports data", async () => {
    const blockedWrite = await fetch(`${baseUrl}/api/collections/products/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: { name: "Blocked" } })
    });
    assert.equal(blockedWrite.status, 401);

    const file = await post(
      "/api/files",
      {
        name: "hello.txt",
        data: "hello",
        encoding: "utf8",
        contentType: "text/plain"
      },
      token
    );

    assert.equal(file.name, "hello.txt");

    const files = await get("/api/files", token);
    assert.equal(files.length, 1);

    const apiKey = await post("/api/admin/auth/api-keys", { label: "smoke" }, token);
    assert.match(apiKey.key, /^ob_/);

    const deniedAdmin = await fetch(`${baseUrl}/api/admin/auth/users`, {
      headers: { "x-openbackend-api-key": apiKey.key }
    });
    assert.equal(deniedAdmin.status, 401);

    const apiKeyWrite = await fetch(`${baseUrl}/api/collections/products/documents`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-openbackend-api-key": apiKey.key
      },
      body: JSON.stringify({ data: { name: "Coffee", price: 4.5 } })
    });
    assert.equal(apiKeyWrite.status, 201);

    const exported = await get("/api/admin/export", token);
    assert.ok(exported.database.documents);
    assert.equal(exported.storage.objects.length, 1);

    const deletedFile = await fetch(`${baseUrl}/api/files/${file.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(deletedFile.status, 200);

    const filesAfterDelete = await get("/api/files", token);
    assert.equal(filesAfterDelete.length, 0);
  });

  it("imports document snapshots", async () => {
  const imported = await post(
      "/api/admin/import",
      {
        database: {
          documents: [
            {
              id: "seed-1",
              collection: "settings",
              data: { mode: "local" }
            }
          ]
        }
      },
      token
    );

    assert.equal(imported.importedDocuments, 1);

    const settings = await get("/api/collections/settings/documents", token);
    assert.equal(settings[0].data.mode, "local");
  });

  it("requires auth for realtime sockets", async () => {
    const denied = await socketCloseCode(`${baseUrl.replace("http", "ws")}/realtime`);
    assert.equal(denied, 1008);

    const allowed = new WebSocket(`${baseUrl.replace("http", "ws")}/realtime?token=${token}`);
    await new Promise((resolve, reject) => {
      allowed.once("open", resolve);
      allowed.once("error", reject);
    });
    allowed.close();
  });
});

async function waitForHealth() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error("Server did not become healthy");
}

async function get(path, sessionToken) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}
  });
  if (!response.ok) {
    assert.fail(await response.text());
  }

  return response.json();
}

async function post(path, body, sessionToken) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    assert.fail(await response.text());
  }

  return response.json();
}

async function socketCloseCode(url) {
  const socket = new WebSocket(url);
  return new Promise((resolve, reject) => {
    socket.once("close", (code) => resolve(code));
    socket.once("error", reject);
  });
}
