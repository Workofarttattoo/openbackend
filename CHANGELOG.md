# Changelog

All notable OpenBackend changes are tracked here. The project uses versioned Git tags and keeps release notes focused on operator impact.

## 0.1.0-alpha.0 - 2026-05-29

- Scaffolded the OpenBackend monorepo with server, dashboard, SDK, auth, database, realtime, storage, and functions packages.
- Added SQLite document collections, WebSocket realtime updates, self-hosted email/password auth, API keys, local file storage, and a local function runner.
- Added PostgreSQL and MinIO runtime profiles for NAS/VPS deployments.
- Added collection-level permission rules with dashboard editing.
- Added export/import plus backup/restore for SQLite/filesystem, PostgreSQL document snapshots, and MinIO bucket objects.
- Added one-command Docker deployment profiles for local, NAS, and VPS sizes.
- Added Docker profile smoke scripts, TLS validation script, and GitHub Actions CI for lint/build/test.
- Added structured request logs, health details, metrics endpoints, and dashboard audit-log visibility.
- Added clean-room, security, hardening, release, and installation documentation.
