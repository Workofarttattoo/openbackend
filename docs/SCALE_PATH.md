# Scale Path

OpenBackend should scale without forcing users into a paid service or hosted account.

## Size 1: Local

```bash
npm run deploy -- local
```

- SQLite document database.
- Local filesystem object storage.
- Local function registry.
- Best for laptops, website builds, kiosks, POS terminals, demos, and small internal tools.

## Size 2: NAS

```bash
npm run deploy -- nas
```

- OpenBackend service.
- Optional MinIO container for S3-compatible object storage.
- Persistent `./data` bind mount for easy backup to NAS/external drives.
- Best for client websites, LAN apps, shared office tools, and small device fleets.

## Size 3: VPS

```bash
npm run deploy -- vps
```

- OpenBackend service.
- Optional MinIO object storage.
- Optional PostgreSQL service for the future server-mode adapter.
- Best for larger self-hosted deployments.

## Rules

- No mandatory cloud provider.
- No mandatory managed database.
- No mandatory subscription feature flags.
- No paid tier gates in the open-source repo.
- Paid hosting can exist later only as optional convenience, never as a dependency for core features.
