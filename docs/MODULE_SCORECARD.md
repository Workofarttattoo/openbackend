# Module Scorecard

Use this scorecard to keep module quality visible as OpenBackend grows.

| Module | MVP status | Deploy risk | Next hardening task |
| --- | --- | --- | --- |
| Database | SQLite/PostgreSQL CRUD, revisions, export/import | Medium | Conflict metadata and offline queue |
| Realtime | Collection watch events with optional auth | Medium | Reconnect hints |
| Auth | SQLite users/sessions/API keys, roles, and protected admin routes | Medium | Field-level permission rules |
| Storage | Filesystem and MinIO object storage | Medium | Multipart upload and retention policies |
| Functions | Local HTTP trigger with audit logging, timeout, and worker VM isolation | Medium | Container or microVM sandbox for untrusted code |
| Dashboard | Login/bootstrap, protected admin calls, permissions, metrics, and audit logs | Medium | Field-level permissions and restore UI |
| SDK | CRUD, auth, storage, functions, watch, auth headers | Medium | Migration helpers and offline queue |
| DevOps | Docker Compose, CI, healthcheck, env docs, backup/restore scripts, release docs | Medium | Signed releases and backup encryption |

## Scoring Rules

- Low risk: usable locally and acceptable for private alpha.
- Medium risk: works but lacks an important production guard.
- High risk: can lose data, expose admin behavior, or surprise operators.
