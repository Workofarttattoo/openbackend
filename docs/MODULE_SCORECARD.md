# Module Scorecard

Use this scorecard to keep module quality visible as OpenBackend grows.

| Module | MVP status | Deploy risk | Next hardening task |
| --- | --- | --- | --- |
| Database | CRUD, revisions, export/import | Medium | Conflict metadata and offline queue |
| Realtime | Collection watch events with optional auth | Medium | Reconnect hints |
| Auth | SQLite users/sessions/API keys, roles, and protected admin routes | Medium | Field-level permission rules |
| Storage | Local disk writes with SQLite metadata | Medium | Delete support and MinIO adapter |
| Functions | Local HTTP trigger with audit logging, timeout, and worker isolation option | Medium | Strong sandbox policies and resource quotas |
| Dashboard | Login/bootstrap and protected admin calls | Medium | Import UI and API-key management |
| SDK | CRUD, auth, storage, functions, watch, auth headers | Medium | Migration helpers and offline queue |
| DevOps | Docker Compose, healthcheck, env docs, backup/restore scripts | Medium | Release packaging |

## Scoring Rules

- Low risk: usable locally and acceptable for private alpha.
- Medium risk: works but lacks an important production guard.
- High risk: can lose data, expose admin behavior, or surprise operators.
