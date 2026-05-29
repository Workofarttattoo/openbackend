# bMAD Build Plan

This project uses bMAD as an operating loop, not just a planning exercise.

## Method

1. Break down the backend platform into modules.
2. Map each module to user-facing behavior.
3. Analyze open-source alternatives and category patterns.
4. Design an original OpenBackend implementation.
5. Develop modular code behind stable package boundaries.
6. Improve each module beyond the cloud-first reference pattern.

## Product Modules

| Module | User behavior | OpenBackend design | Improvement target |
| --- | --- | --- | --- |
| Database | Create collections, write JSON documents, query and watch records | SQLite-backed document collections | Offline write queue and import/export |
| Realtime | Subscribe to collection changes | WebSocket event bus | LAN/local-first operation without managed infra |
| Auth | Create users, log in, use API keys | SQLite identities, sessions, API keys | Self-hosted identity by default |
| Storage | Upload/download files | Filesystem adapter plus SQLite metadata | Local disk/NAS support |
| Functions | Run backend logic | Local function registry | No cloud deployment required |
| Dashboard | Manage backend visually | React/Vite operational UI | Export/import and local admin controls |
| SDK | Use backend from apps | TypeScript REST/WebSocket client | Migration helpers and offline writes |
| DevOps | Self-host safely | Docker Compose, env config, backups | Laptop-to-NAS-to-VPS path |

## Current Execution Track

### Alpha Deploy Readiness

- [x] Environment configuration and `.env.example`
- [x] Restricted production CORS
- [x] Persistent auth sessions and API keys
- [x] Protected admin routes
- [x] Persistent file metadata
- [x] Export/import endpoint
- [x] Backup script
- [x] Docker healthcheck
- [x] Integration tests
- [x] Deploy guide
- [x] Dashboard login/bootstrap flow
- [x] One-button Docker deploy command
- [x] Scale profiles for local, NAS, and VPS deployments

## Definition of Done

A bMAD slice is done when it has:

- A documented user behavior.
- Original implementation code.
- Local validation through build/test or a runtime smoke.
- A note in the relevant project doc if behavior changes.
