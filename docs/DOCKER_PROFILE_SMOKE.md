# Docker Profile Smoke Tests

OpenBackend includes end-to-end Docker smoke tests for every deploy size.

## Commands

```bash
npm run smoke:docker:local
npm run smoke:docker:nas
npm run smoke:docker:vps
npm run smoke:docker
```

Each smoke test:

- Starts the matching Docker Compose profile.
- Waits for `/health`.
- Verifies the reported database/storage runtime.
- Bootstraps an admin.
- Creates a document.
- Uploads a file.
- Lists data back.
- Exports data.
- Tears the stack down with volumes.

## Runtime Coverage

| Smoke | Database | Storage |
| --- | --- | --- |
| `local` | SQLite | Filesystem |
| `nas` | SQLite | MinIO |
| `vps` | PostgreSQL | MinIO |

## Requirement

Docker Desktop or Docker Engine must be running. If Docker is stopped, the smoke runner will fail before starting the stack.

