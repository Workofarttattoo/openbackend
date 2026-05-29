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

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Data is stored under `./data` by default. Mount that folder to a persistent disk for NAS/VPS installs.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `OPENBACKEND_HOST` | Bind host for the server |
| `OPENBACKEND_PORT` | HTTP/WebSocket port |
| `OPENBACKEND_DATA_DIR` | SQLite databases and file object root |
| `OPENBACKEND_PUBLIC_URL` | Public base URL shown in docs/scripts |
| `OPENBACKEND_CORS_ORIGINS` | Comma-separated allowed browser origins |
| `OPENBACKEND_REQUIRE_AUTH` | Require sessions/API keys for protected admin APIs |
| `OPENBACKEND_MAX_UPLOAD_BYTES` | Maximum JSON upload payload size |
| `OPENBACKEND_BACKUP_DIR` | Destination for local backup snapshots |

## First Admin

The first admin user should be created through the bootstrap endpoint or dashboard bootstrap flow. After at least one user exists, user creation moves behind protected admin APIs.

## Backup

Use the backup script before upgrades and on a schedule:

```bash
npm run backup
```

The script copies local SQLite databases and file objects into `OPENBACKEND_BACKUP_DIR`.

