import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { join } from "node:path";
import { AuthService, type AuthRole, type Principal } from "@openbackend/auth";
import { CollectionStore, PostgresCollectionStore, type DatabaseAdapter } from "@openbackend/database";
import { FunctionRegistry } from "@openbackend/functions";
import { RealtimeHub } from "@openbackend/realtime";
import { LocalObjectStorage, S3CompatibleObjectStorage, type ObjectStorageAdapter } from "@openbackend/storage";
import { loadConfig } from "./config.js";

const config = loadConfig();

const database: DatabaseAdapter = await createDatabase();
const auth = new AuthService(join(config.dataDir, "auth.sqlite"), {
  sessionTtlMs: config.sessionTtlHours * 60 * 60 * 1000
});
const storage: ObjectStorageAdapter = await createStorage();
const functions = new FunctionRegistry({ timeoutMs: config.functionTimeoutMs });
const realtime = new RealtimeHub({
  authorize: (token, apiKey) => {
    if (!config.requireRealtimeAuth) {
      return true;
    }

    return Boolean(resolvePrincipal(token ? `Bearer ${token}` : undefined, apiKey));
  }
});
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

functions.registerIsolated(
  "hello",
  `(async (context) => ({
    ok: true,
    message: "Hello from an isolated local OpenBackend function.",
    input: context.body
  }))`
);

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin || config.corsOrigins.includes(origin)) {
        return origin;
      }

      return config.publicUrl;
    }
  })
);

app.onError((error, c) => {
  const status = error.message.includes("not found") ? 404 : 400;
  return c.json({ error: { message: error.message } }, status);
});

app.use(async (c, next) => {
  const key = c.req.header("x-forwarded-for") ?? c.req.header("cf-connecting-ip") ?? "local";
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + config.rateLimitWindowMs });
    await next();
    return;
  }

  bucket.count += 1;
  if (bucket.count > config.rateLimitMax) {
    return c.json({ error: { message: "Rate limit exceeded" } }, 429);
  }

  await next();
});

app.use("/api/admin/*", async (c, next) => {
  if (!config.requireAuth || hasRole(c.req.header("authorization"), c.req.header("x-openbackend-api-key"), ["admin"])) {
    await next();
    return;
  }

  return c.json({ error: { message: "Admin authorization required" } }, 401);
});

app.use(async (c, next) => {
  if (!config.requireWriteAuth || !isWriteRequest(c.req.method, c.req.path)) {
    await next();
    return;
  }

  if (hasRole(c.req.header("authorization"), c.req.header("x-openbackend-api-key"), ["admin", "editor", "device"])) {
    await next();
    return;
  }

  return c.json({ error: { message: "Write authorization required" } }, 401);
});

app.get("/health", (c) => {
  return c.json({
    ok: true,
    name: "openbackend",
    mode: config.deploySize,
    storage: config.storageDriver,
    database: config.databaseDriver
  });
});

app.get("/api/collections", async (c) => c.json(await database.collections()));

app.get("/api/collections/:collection/documents", async (c) => {
  const collection = c.req.param("collection");
  if (!canReadCollection(collection, c.req.header("authorization"), c.req.header("x-openbackend-api-key"))) {
    return c.json({ error: { message: "Collection read authorization required" } }, 401);
  }

  return c.json(await database.list(collection));
});

app.post("/api/collections/:collection/documents", async (c) => {
  const collection = c.req.param("collection");
  if (!canWriteCollection(collection, c.req.header("authorization"), c.req.header("x-openbackend-api-key"))) {
    return c.json({ error: { message: "Collection write authorization required" } }, 401);
  }

  const body = await c.req.json<{ id?: string; data: unknown }>();
  const change = await database.create(collection, body.data, body.id);
  audit("document.created", { collection: change.document.collection, id: change.document.id });
  realtime.publish({
    topic: `collections:${change.document.collection}`,
    type: change.type,
    payload: change.document
  });

  return c.json(change.document, 201);
});

app.patch("/api/collections/:collection/documents/:id", async (c) => {
  const collection = c.req.param("collection");
  if (!canWriteCollection(collection, c.req.header("authorization"), c.req.header("x-openbackend-api-key"))) {
    return c.json({ error: { message: "Collection write authorization required" } }, 401);
  }

  const body = await c.req.json<{ data: Record<string, unknown> }>();
  const change = await database.update(collection, c.req.param("id"), body.data);
  audit("document.updated", { collection: change.document.collection, id: change.document.id });
  realtime.publish({
    topic: `collections:${change.document.collection}`,
    type: change.type,
    payload: change.document
  });

  return c.json(change.document);
});

app.delete("/api/collections/:collection/documents/:id", async (c) => {
  const collection = c.req.param("collection");
  if (!canWriteCollection(collection, c.req.header("authorization"), c.req.header("x-openbackend-api-key"))) {
    return c.json({ error: { message: "Collection write authorization required" } }, 401);
  }

  const change = await database.delete(collection, c.req.param("id"));
  audit("document.deleted", { collection: change.document.collection, id: change.document.id });
  realtime.publish({
    topic: `collections:${change.document.collection}`,
    type: change.type,
    payload: change.document
  });

  return c.json(change.document);
});

app.get("/api/auth/bootstrap", (c) => c.json({ required: auth.userCount() === 0 }));

app.post("/api/auth/bootstrap", async (c) => {
  if (auth.userCount() > 0) {
    return c.json({ error: { message: "Bootstrap is already complete" } }, 409);
  }

  const body = await c.req.json<{ email: string; password: string }>();
  const user = auth.createUser(body.email, body.password, "admin");
  const session = auth.login(body.email, body.password);
  audit("auth.bootstrap", { userId: user.id });

  return c.json({ user, session }, 201);
});

app.post("/api/auth/sessions", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  return c.json(auth.login(body.email, body.password));
});

app.delete("/api/auth/sessions", (c) => {
  const token = bearerToken(c.req.header("authorization"));
  if (token) {
    auth.logout(token);
  }

  return c.json({ ok: true });
});

app.get("/api/admin/auth/users", (c) => c.json(auth.listUsers()));

app.post("/api/admin/auth/users", async (c) => {
  const body = await c.req.json<{ email: string; password: string; role?: AuthRole }>();
  const user = auth.createUser(body.email, body.password, body.role ?? "editor");
  audit("auth.user.created", { userId: user.id });
  return c.json(user, 201);
});

app.get("/api/admin/auth/api-keys", (c) => c.json(auth.listApiKeys()));

app.post("/api/admin/auth/api-keys", async (c) => {
  const body = await c.req.json<{ label?: string; role?: AuthRole }>();
  const apiKey = auth.createApiKey(body.label ?? "default", body.role ?? "device");
  audit("auth.api_key.created", { label: apiKey.label });
  return c.json(apiKey, 201);
});

app.post("/api/files", async (c) => {
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > config.maxUploadBytes) {
    return c.json({ error: { message: "Upload is larger than the configured limit" } }, 413);
  }

  const body = await c.req.json<{
    name: string;
    data: string;
    contentType?: string;
    encoding?: BufferEncoding;
  }>();
  const object = await storage.put({
    name: body.name,
    contentType: body.contentType,
    data: Buffer.from(body.data, body.encoding ?? "base64")
  });
  audit("file.created", { id: object.id, name: object.name, size: object.size });

  realtime.publish({
    topic: "files",
    type: "created",
    payload: object
  });

  return c.json(object, 201);
});

app.get("/api/files", async (c) => c.json(await storage.list()));

app.get("/api/files/:id", async (c) => {
  const found = await storage.get(c.req.param("id"));
  if (!found) {
    return c.text("File not found", 404);
  }

  const arrayBuffer = found.data.buffer.slice(
    found.data.byteOffset,
    found.data.byteOffset + found.data.byteLength
  ) as ArrayBuffer;
  const body = new Uint8Array(arrayBuffer);
  return c.body(body, 200, {
    "content-type": found.object.contentType,
    "content-disposition": `attachment; filename="${found.object.name}"`
  });
});

app.delete("/api/files/:id", async (c) => {
  const object = await storage.delete(c.req.param("id"));
  audit("file.deleted", { id: object.id, name: object.name });
  realtime.publish({
    topic: "files",
    type: "deleted",
    payload: object
  });

  return c.json(object);
});

app.get("/api/functions", (c) => c.json(functions.list()));

app.post("/api/functions/:name", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const headers = Object.fromEntries(c.req.raw.headers.entries());
  const result = await functions.run(c.req.param("name"), { body, headers });
  audit("function.ran", { name: c.req.param("name") });
  return c.json(result);
});

app.get("/api/admin/export", async (c) => {
  return c.json({
    exportedAt: new Date().toISOString(),
    database: await database.exportSnapshot(),
    storage: {
      objects: await storage.exportMetadata()
    }
  });
});

app.post("/api/admin/import", async (c) => {
  const body = await c.req.json<{ database?: { documents?: unknown[] } }>();
  const importedDocuments = body.database ? await database.importSnapshot(body.database) : 0;
  audit("data.imported", { importedDocuments });
  return c.json({ importedDocuments });
});

app.get("/api/export", (c) => c.redirect("/api/admin/export"));

const server = serve({
  fetch: app.fetch,
  hostname: config.host,
  port: config.port
});

realtime.attach(server as Parameters<typeof realtime.attach>[0]);

console.log(`[info] OpenBackend server listening on http://${config.host}:${config.port}`);

function hasRole(authorization: string | undefined, apiKey: string | undefined, roles: AuthRole[]): boolean {
  const principal = resolvePrincipal(authorization, apiKey);
  return Boolean(principal && roles.includes(principal.role));
}

function canReadCollection(collection: string, authorization: string | undefined, apiKey: string | undefined): boolean {
  const roles = config.collectionPermissions[collection]?.read;
  if (!roles || roles.length === 0) {
    return true;
  }

  return hasRole(authorization, apiKey, roles);
}

function canWriteCollection(collection: string, authorization: string | undefined, apiKey: string | undefined): boolean {
  const roles = config.collectionPermissions[collection]?.write;
  if (!roles || roles.length === 0) {
    return true;
  }

  return hasRole(authorization, apiKey, roles);
}

function resolvePrincipal(authorization: string | undefined, apiKey: string | null | undefined): Principal | null {
  const token = bearerToken(authorization);
  if (token && auth.getSession(token)) {
    return auth.getPrincipalFromSession(token);
  }

  return apiKey ? auth.getPrincipalFromApiKey(apiKey) : null;
}

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

function isWriteRequest(method: string, path: string): boolean {
  if (!["POST", "PATCH", "DELETE"].includes(method)) {
    return false;
  }

  return (
    path.startsWith("/api/collections/") ||
    path === "/api/files" ||
    path.startsWith("/api/files/") ||
    path.startsWith("/api/functions/")
  );
}

function audit(action: string, metadata: Record<string, unknown>): void {
  void Promise.resolve(
    database.create("audit_logs", {
      action,
      metadata,
      createdAt: new Date().toISOString()
    })
  ).catch((error) => {
    console.warn(`[warn] Failed to write audit log: ${(error as Error).message}`);
  });
}

async function createDatabase(): Promise<DatabaseAdapter> {
  if (config.databaseDriver === "postgres") {
    if (!config.postgresUrl) {
      throw new Error("OPENBACKEND_POSTGRES_URL is required when OPENBACKEND_DATABASE=postgres");
    }

    return PostgresCollectionStore.connect(config.postgresUrl);
  }

  return new CollectionStore(join(config.dataDir, "openbackend.sqlite"));
}

async function createStorage(): Promise<ObjectStorageAdapter> {
  if (config.storageDriver === "minio") {
    if (!config.s3Endpoint) {
      throw new Error("OPENBACKEND_S3_ENDPOINT is required when OPENBACKEND_STORAGE=minio");
    }

    return S3CompatibleObjectStorage.connect({
      endpoint: config.s3Endpoint,
      bucket: config.s3Bucket,
      accessKeyId: config.s3AccessKeyId ?? undefined,
      secretAccessKey: config.s3SecretAccessKey ?? undefined
    });
  }

  return new LocalObjectStorage(join(config.dataDir, "files"), join(config.dataDir, "storage.sqlite"));
}
