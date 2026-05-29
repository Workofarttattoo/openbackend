# Deploy Readiness Checklist

This checklist gates the first self-hosted alpha.

## Must Do

- [x] `.env.example` with all supported deploy knobs.
- [x] Session lookup for protected admin requests.
- [x] API-key validation middleware.
- [x] Password minimum and structured auth errors.
- [x] Persistent storage metadata.
- [x] Restricted CORS in production.
- [x] Docker healthcheck.
- [x] Import endpoint paired with export.
- [x] Backup command for SQLite databases and file objects.
- [x] Restore command for SQLite databases and file objects.
- [x] Server integration tests.
- [x] README deploy section.
- [x] One-button deploy command.
- [x] Scalable self-hosted deploy profiles.
- [x] Docker profile smoke test commands for local, NAS, and VPS.
- [x] Real-domain TLS smoke command and checklist.
- [x] PostgreSQL and MinIO backup/restore profile support.
- [x] GitHub Actions lint/build/test CI.
- [x] Release packaging docs, changelog, and versioned tag process.
- [x] Threat model, disclosure policy, and hardening checklist.
- [x] Structured logs, metrics endpoints, health details, and audit log view.

## Should Do

- [x] Request size limits for uploads.
- [x] Basic audit log table or log collection.
- [x] Admin dashboard login screen.
- [x] Bootstrap first admin safely.
- [x] `LICENSE` before public release.

## Not Blockers Yet

- CRDT conflict resolution.
- Hardened untrusted-code function sandboxing for public production.
- Field-level permission rules for public production.
- Signed/encrypted backups.

## Alpha Deploy Command

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

Release candidate validation:

```bash
npm run release:check
npm run smoke:docker
```
