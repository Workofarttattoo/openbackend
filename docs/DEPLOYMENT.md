# Deployment Guide

OpenBackend is designed to move from laptop to NAS to VPS without requiring paid cloud services.

## Local Laptop

```bash
cp .env.example .env
npm install
npm run dev
```

Server: `http://127.0.0.1:8787`

Dashboard:

```bash
npm run dev -w apps/dashboard
```

## One-Button Deploy

```bash
cp .env.example .env
npm run deploy
```

That command builds and starts OpenBackend with Docker Compose. Data is stored under `./data` by default. Mount that folder to a persistent disk for NAS/VPS installs.

## Scale Sizes

OpenBackend has no mandatory payment gates. Each size runs on infrastructure you control.

| Size | Command | Included services | Best fit |
| --- | --- | --- | --- |
| Local | `npm run deploy -- local` | OpenBackend, SQLite, local filesystem storage | Laptop, dev machine, kiosk |
| NAS | `npm run deploy -- nas` | OpenBackend plus MinIO object storage service | Home lab, office NAS, shared LAN |
| VPS | `npm run deploy -- vps` | OpenBackend plus MinIO and PostgreSQL services | Larger self-hosted server |

The local profile uses SQLite and filesystem storage. The NAS profile switches storage to MinIO. The VPS profile switches storage to MinIO and documents to PostgreSQL.

Stop services:

```bash
npm run stop
```

Manual Compose equivalent:

```bash
docker compose up --build -d
docker compose --profile nas up --build -d
docker compose --profile vps up --build -d
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `OPENBACKEND_HOST` | Bind host for the server |
| `OPENBACKEND_PORT` | HTTP/WebSocket port |
| `OPENBACKEND_DATA_DIR` | SQLite databases and file object root |
| `OPENBACKEND_PUBLIC_URL` | Public base URL shown in docs/scripts |
| `OPENBACKEND_CORS_ORIGINS` | Comma-separated allowed browser origins |
| `OPENBACKEND_DEPLOY_SIZE` | `local`, `nas`, or `vps` deployment profile |
| `OPENBACKEND_DATABASE` | `sqlite` or `postgres` |
| `OPENBACKEND_STORAGE` | `filesystem` or `minio` |
| `OPENBACKEND_REQUIRE_AUTH` | Require sessions/API keys for protected admin APIs |
| `OPENBACKEND_REQUIRE_WRITE_AUTH` | Require sessions/API keys for collection writes, uploads, and function runs |
| `OPENBACKEND_MAX_UPLOAD_BYTES` | Maximum JSON upload payload size |
| `OPENBACKEND_BACKUP_DIR` | Destination for local backup snapshots |
| `OPENBACKEND_SESSION_TTL_HOURS` | Session lifetime in hours |
| `OPENBACKEND_RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds |
| `OPENBACKEND_RATE_LIMIT_MAX` | Max requests per window per client IP |
| `OPENBACKEND_FUNCTION_TIMEOUT_MS` | Local function timeout in milliseconds |
| `OPENBACKEND_REQUIRE_REALTIME_AUTH` | Require token/API key for WebSocket watches |
| `OPENBACKEND_COLLECTION_PERMISSIONS` | JSON map of collection read/write role rules |
| `MINIO_ROOT_USER` | Optional MinIO admin user for NAS/VPS profile |
| `MINIO_ROOT_PASSWORD` | Optional MinIO admin password for NAS/VPS profile |
| `POSTGRES_DB` | Optional PostgreSQL database for VPS profile |
| `POSTGRES_USER` | Optional PostgreSQL user for VPS profile |
| `POSTGRES_PASSWORD` | Optional PostgreSQL password for VPS profile |
| `OPENBACKEND_POSTGRES_URL` | PostgreSQL connection string when `OPENBACKEND_DATABASE=postgres` |
| `OPENBACKEND_S3_ENDPOINT` | MinIO/S3-compatible endpoint when `OPENBACKEND_STORAGE=minio` |
| `OPENBACKEND_S3_BUCKET` | MinIO/S3-compatible bucket name |
| `OPENBACKEND_S3_ACCESS_KEY_ID` | MinIO/S3 access key |
| `OPENBACKEND_S3_SECRET_ACCESS_KEY` | MinIO/S3 secret key |

## Collection Permissions

Public reads are allowed by default. Writes require an authenticated `admin`, `editor`, or `device` role by default. Add per-collection rules with JSON:

```bash
OPENBACKEND_COLLECTION_PERMISSIONS='{
  "private_notes": {
    "read": ["admin", "viewer"],
    "write": ["admin"]
  },
  "website_posts": {
    "write": ["admin", "editor"]
  }
}'
```

Roles are `admin`, `editor`, `viewer`, and `device`.

## No-Fee Deployment Principles

- No required hosted account.
- No required managed database.
- No required object storage subscription.
- No required proprietary runtime.
- Scale-up services are self-hosted open-source containers.
- Operators can run on a laptop, kiosk box, NAS, Raspberry Pi-class host, or VPS they already control.

## TLS Reverse Proxy Templates

Starter templates live in:

- `deploy/caddy/Caddyfile`
- `deploy/nginx/openbackend.conf`

Use Caddy for automatic certificates on a VPS, or Nginx behind your existing certificate automation. OpenBackend itself remains a plain local HTTP service behind the proxy.

Run the real-domain TLS smoke after DNS points to the host:

```bash
OPENBACKEND_DOMAIN=backend.example.com npm run smoke:tls
```

See `docs/TLS_VALIDATION.md` for the full checklist.

## First Admin

The first admin user should be created through the bootstrap endpoint or dashboard bootstrap flow. After at least one user exists, user creation moves behind protected admin APIs.

## Backup

Use the backup script before upgrades and on a schedule:

```bash
npm run backup
```

The script copies local SQLite databases and file objects into `OPENBACKEND_BACKUP_DIR`.

Restore the latest backup:

```bash
npm run restore
```

Restore a specific backup:

```bash
npm run restore -- ./backups/2026-05-29T15-33-32.371Z
```

Stop the server before restoring so SQLite files are not open while being replaced.

## Kiosk and Device Writes

Mutating APIs require a session bearer token or `x-openbackend-api-key` by default. Create a device API key from the admin API, then pass it to the POS kiosk with `?apiKey=...` or paste it into the kiosk field.
