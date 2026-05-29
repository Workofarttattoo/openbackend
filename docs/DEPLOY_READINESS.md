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

## Should Do

- [x] Request size limits for uploads.
- [x] Basic audit log table or log collection.
- [x] Admin dashboard login screen.
- [x] Bootstrap first admin safely.
- [x] `LICENSE` before public release.

## Not Blockers Yet

- PostgreSQL mode.
- MinIO adapter.
- CRDT conflict resolution.
- Function sandboxing.
- Full permission rules engine.

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
