# Freebase Local / OpenBackend

Firebase-style developer experience, open-source local-first implementation.

OpenBackend is a clean-room, permissive backend platform for small apps, kiosks, POS systems, IoT dashboards, and internal tools. It is designed to run on a laptop, NAS, Raspberry Pi, or VPS with no mandatory cloud account and no paid service dependency.

## Mission

OpenBackend provides:

- Local-first document collections backed by SQLite.
- Optional PostgreSQL path for multi-user server deployments.
- WebSocket realtime collection updates.
- Self-hosted authentication with email/password sessions and API keys.
- File/object storage through local disk now, S3-compatible adapters later.
- Server-side functions that run locally.
- Admin dashboard for collections, users, files, logs, and functions.
- JavaScript/TypeScript SDK with a small original API.
- Docker Compose deployment for local or self-hosted operation.

## Clean-Room Rules

This project is inspired by the broad developer-experience category of hosted backend platforms, but it is implemented independently.

- Do not copy Firebase proprietary code, docs, product names, branding, logos, UI assets, or protected identity.
- Do not use public API names such as `initializeApp`, Firestore, Cloud Functions, Firebase Auth, Firebase Storage, or Realtime Database in OpenBackend public APIs.
- Use public open-source projects only through their documented interfaces and licenses.
- Keep dependency license notices intact.
- Write custom modules originally.

See [docs/CLEAN_ROOM.md](docs/CLEAN_ROOM.md) for the full safety note.
See [docs/RESEARCH.md](docs/RESEARCH.md) for the first-pass open-source component evaluation.
See [docs/HOSTED_BACKEND_PARITY.md](docs/HOSTED_BACKEND_PARITY.md) for the clean-room parity matrix.
See [docs/BMAD_BUILD_PLAN.md](docs/BMAD_BUILD_PLAN.md), [docs/MODULE_SCORECARD.md](docs/MODULE_SCORECARD.md), and [docs/DEPLOY_READINESS.md](docs/DEPLOY_READINESS.md) for project execution tracking.
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for local, NAS, and Docker deployment notes.

## Quick Start

```bash
npm install
npm run dev
```

The server starts on `http://localhost:8787` and the dashboard starts on `http://localhost:5173`.

For deploy configuration:

```bash
cp .env.example .env
```

## Self-Hosted Alpha

```bash
cp .env.example .env
npm install
npm run build
npm run dev
```

For Docker:

```bash
docker compose up --build
```

Before upgrades or experiments, create a local snapshot:

```bash
npm run backup
```

The first dashboard visit bootstraps an admin user. After bootstrap, protected admin APIs require a session bearer token or `x-openbackend-api-key`.
Collection writes, file uploads, and function runs also require a session or API key by default for self-hosted safety.

## SDK Example

```ts
import { createOpenBackend } from "@openbackend/sdk-js";

const app = createOpenBackend({ url: "http://localhost:8787" });
const db = app.database();
const users = db.collection("users");

await users.create({ name: "Joshua", role: "admin" });

const stop = users.watch((items) => {
  console.log(items);
});
```

## Monorepo Layout

```text
apps/
  dashboard/        Vite admin dashboard
  server/           Local backend service
packages/
  auth/             Email/password and API key primitives
  database/         SQLite document collection engine
  functions/        Local function registry/runtime
  realtime/         WebSocket event bus
  sdk-js/           TypeScript client SDK
  storage/          Filesystem object storage
docs/               Architecture and clean-room notes
examples/           POS/kiosk, website, and IoT demos
```

## Roadmap

- SQLite local-first document store with offline write queue.
- PostgreSQL sync adapter for multi-user server mode.
- CRDT-friendly conflict metadata.
- MinIO/S3-compatible storage adapter.
- Dashboard export/import and scheduled backups.
- Function triggers for document and file events.
- Migration helpers for small apps leaving hosted backends.
