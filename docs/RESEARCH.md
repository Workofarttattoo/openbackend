# Open-Source Component Evaluation

This is the first-pass bMAD component map. OpenBackend should use mature components where they strengthen reliability, while keeping project APIs original and clean-room.

| Role | Candidates | MVP Choice | Notes |
| --- | --- | --- | --- |
| Database | SQLite, PostgreSQL, LiteFS, ElectricSQL, RxDB, PouchDB, CouchDB, PocketBase | SQLite | SQLite gives the strongest local-first baseline. PostgreSQL remains the preferred server-mode target. ElectricSQL and LiteFS are future sync/replication candidates. |
| Realtime sync | WebSockets, CRDTs, Yjs, Automerge, ElectricSQL, Supabase Realtime | WebSockets | WebSocket fanout is enough for document watch in the MVP. Yjs/Automerge are better suited for collaborative field-level edits later. |
| Auth | Lucia Auth, Auth.js, Ory Kratos, SuperTokens | Original minimal module | The first module provides self-hosted email/password and sessions. Ory/SuperTokens are candidates if advanced identity flows become a priority. |
| Storage | MinIO, filesystem adapter, S3-compatible API | Filesystem adapter | Local/NAS storage is the default. MinIO is the natural self-hosted S3-compatible upgrade. |
| Functions | Node worker runtime, Deno, OpenFaaS, serverless-http | Node local registry | Local function execution is simplest for kiosks and internal tools. Worker isolation can be added without changing the public SDK. |
| Dashboard | React, Vite, shadcn/ui, Tailwind | React + Vite | The dashboard starts as a compact operational UI. shadcn/ui and Tailwind remain good candidates when the component set grows. |
| API | FastAPI, Hono, Express, NestJS, tRPC | Hono | Hono keeps local server code small and portable while supporting typed request handlers. |
| SDKs | TypeScript REST client, WebSocket client | TypeScript REST + WebSocket | The SDK wraps CRUD and watch flows with original API names. Migration helpers are planned as optional utilities. |

## Design Guardrails

- Prefer local-first behavior before remote coordination.
- Keep modules swappable through package-level service classes.
- Avoid mandatory external services.
- Preserve license notices for every dependency.
- Do not clone protected product names, docs, assets, or UI identity.

