import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { join } from "node:path";
import { AuthService } from "@openbackend/auth";
import { CollectionStore } from "@openbackend/database";
import { FunctionRegistry } from "@openbackend/functions";
import { RealtimeHub } from "@openbackend/realtime";
import { LocalObjectStorage } from "@openbackend/storage";

const dataDir = process.env.OPENBACKEND_DATA_DIR ?? join(process.cwd(), "data");
const host = process.env.OPENBACKEND_HOST ?? "127.0.0.1";
const port = Number(process.env.OPENBACKEND_PORT ?? "8787");

const database = new CollectionStore(join(dataDir, "openbackend.sqlite"));
const auth = new AuthService(join(dataDir, "auth.sqlite"));
const storage = new LocalObjectStorage(join(dataDir, "files"));
const functions = new FunctionRegistry();
const realtime = new RealtimeHub();

functions.register("hello", ({ body }) => ({
  ok: true,
  message: "Hello from a local OpenBackend function.",
  input: body
}));

const app = new Hono();
app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true, name: "openbackend", mode: "local" }));

app.get("/api/collections", (c) => c.json(database.collections()));

app.get("/api/collections/:collection/documents", (c) => {
  return c.json(database.list(c.req.param("collection")));
});

app.post("/api/collections/:collection/documents", async (c) => {
  const body = await c.req.json<{ id?: string; data: unknown }>();
  const change = database.create(c.req.param("collection"), body.data, body.id);
  realtime.publish({
    topic: `collections:${change.document.collection}`,
    type: change.type,
    payload: change.document
  });

  return c.json(change.document, 201);
});

app.patch("/api/collections/:collection/documents/:id", async (c) => {
  const body = await c.req.json<{ data: Record<string, unknown> }>();
  const change = database.update(c.req.param("collection"), c.req.param("id"), body.data);
  realtime.publish({
    topic: `collections:${change.document.collection}`,
    type: change.type,
    payload: change.document
  });

  return c.json(change.document);
});

app.delete("/api/collections/:collection/documents/:id", (c) => {
  const change = database.delete(c.req.param("collection"), c.req.param("id"));
  realtime.publish({
    topic: `collections:${change.document.collection}`,
    type: change.type,
    payload: change.document
  });

  return c.json(change.document);
});

app.post("/api/auth/users", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  return c.json(auth.createUser(body.email, body.password), 201);
});

app.get("/api/auth/users", (c) => c.json(auth.listUsers()));

app.post("/api/auth/sessions", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  return c.json(auth.login(body.email, body.password));
});

app.post("/api/files", async (c) => {
  const body = await c.req.json<{
    name: string;
    data: string;
    contentType?: string;
    encoding?: BufferEncoding;
  }>();
  const object = storage.put({
    name: body.name,
    contentType: body.contentType,
    data: Buffer.from(body.data, body.encoding ?? "base64")
  });

  realtime.publish({
    topic: "files",
    type: "created",
    payload: object
  });

  return c.json(object, 201);
});

app.get("/api/files", (c) => c.json(storage.list()));

app.get("/api/files/:id", (c) => {
  const found = storage.get(c.req.param("id"));
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

app.get("/api/functions", (c) => c.json(functions.list()));

app.post("/api/functions/:name", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const headers = Object.fromEntries(c.req.raw.headers.entries());
  return c.json(await functions.run(c.req.param("name"), { body, headers }));
});

app.get("/api/export", (c) => c.json(database.exportSnapshot()));

const server = serve({
  fetch: app.fetch,
  hostname: host,
  port
});

realtime.attach(server as Parameters<typeof realtime.attach>[0]);

console.log(`[info] OpenBackend server listening on http://${host}:${port}`);
