# Hosted Backend Parity Matrix

This document captures public, category-level capabilities that developers expect from hosted backend platforms and maps them to original OpenBackend designs. It is not a reverse-engineering plan and must not use proprietary scripts, private service behavior, protected branding, copied UI, or copied documentation.

## Clean-Room Method

1. Describe the user-facing job in neutral terms.
2. Identify open-source implementation options.
3. Build an original OpenBackend module and API.
4. Add a local-first or self-hosted improvement.
5. Keep names, docs, UI, and code original.

## Parity and Improvements

| Category expectation | OpenBackend module | Original MVP API/behavior | Improvement beyond cloud-first defaults |
| --- | --- | --- | --- |
| Start a backend quickly | Server app | `npm run dev` starts local HTTP/WebSocket service | No mandatory cloud account or billing setup |
| Store app records | Database package | JSON document collections over SQLite | Local-first data file that can live on laptop, NAS, or external drive |
| Watch data changes | Realtime package | WebSocket topics such as `collections:products` | Works on a LAN without managed realtime infrastructure |
| Create identities | Auth package | Email/password users persisted in local SQLite | Built-in self-hosted identity, no required third-party provider |
| Use device/service credentials | Auth package | API-key table and generator | Local keys for kiosks, POS terminals, and IoT devices |
| Store files | Storage package | Filesystem object adapter | First-class local disk/NAS storage path |
| Run backend logic | Functions package | Local function registry with HTTP trigger | Functions run locally without deployment packaging |
| Manage data visually | Dashboard app | Collections, users, files, functions, export | One-click data export path from day one |
| Use from frontend code | SDK package | `createOpenBackend`, `database`, `collection`, `watch` | Original naming plus future migration helpers |
| Deploy self-hosted | DevOps files | Docker Compose with persistent data volume | Laptop-to-NAS-to-VPS path without vendor lock-in |
| Preserve data | Backup/export | `/api/export` snapshot endpoint | Planned scheduled backup to external disk or NAS |

## Explicit Non-Goals

- No proprietary service reverse engineering.
- No copied backend scripts or private protocols.
- No copied product names, UI assets, docs, screenshots, logos, or marketing identity.
- No compatibility claims unless implemented through public standards or documented, licensed APIs.

## Near-Term Build Order

1. Persistent auth storage.
2. Dashboard user creation and login smoke flow.
3. API-key protected device ingestion.
4. Filesystem object metadata persistence.
5. Import endpoint and scheduled backup command.
6. Offline write queue in the SDK.

