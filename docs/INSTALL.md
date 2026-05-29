# Install

OpenBackend is designed to start locally with no cloud account and no required paid service.

## Local Development

```bash
npm install
npm run dev:all
```

- Backend: `http://localhost:8787`
- Dashboard: `http://localhost:5173`

On first dashboard login, create the initial admin user. After bootstrap, admin APIs require a bearer session token or admin API key.

## One-Command Self-Hosted Deploy

```bash
npm run deploy -- local
```

Scale up without changing products:

```bash
npm run deploy -- nas
npm run deploy -- vps
```

The `local` profile uses SQLite and filesystem storage. The `nas` and `vps` profiles use PostgreSQL and MinIO through Docker Compose.

## Validate Before Use

```bash
npm run release:check
npm run smoke:docker:local
npm run smoke:docker:nas
npm run smoke:docker:vps
```

For a public hostname, configure Caddy or Nginx and then run:

```bash
OPENBACKEND_TLS_DOMAIN=backend.example.com npm run smoke:tls
```

## Backup And Restore

```bash
npm run backup
npm run restore
```

SQLite/filesystem profiles copy local database and files. PostgreSQL profiles export document rows to `postgres-documents.json`. MinIO profiles mirror bucket objects into `minio/`.
