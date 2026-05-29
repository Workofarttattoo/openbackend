# Threat Model

## Scope

This threat model covers the self-hosted OpenBackend server, dashboard, SDK clients, SQLite/PostgreSQL document storage, filesystem/MinIO object storage, WebSocket realtime bus, and local function runner.

## Assets

- Admin session tokens and API keys.
- User password hashes and auth metadata.
- Application documents and object files.
- Backup archives and exported snapshots.
- Function source, inputs, outputs, and logs.
- Deployment secrets such as PostgreSQL URLs and MinIO credentials.

## Trust Boundaries

- Browser clients to HTTP API.
- Browser clients to WebSocket realtime endpoint.
- Dashboard users to admin API.
- Server process to SQLite/PostgreSQL.
- Server process to filesystem/MinIO.
- Server process to function worker runtime.
- Reverse proxy/TLS edge to backend HTTP service.

## Primary Threats

| Threat | Risk | Current Mitigation |
| --- | --- | --- |
| Stolen admin token or API key | Full project control | Auth-required admin APIs, scoped roles, hardening checklist rotation guidance |
| Anonymous writes | Data tampering | Write auth enabled by default |
| Collection overexposure | Data leakage | Collection-level read/write rules |
| Function escape | Host compromise | Worker isolation, timeout, VM code generation disabled; documented as not a hardened sandbox |
| Backup disclosure | Full data disclosure | Docs require backups outside public web roots with filesystem permissions |
| Weak TLS/proxy config | Credential interception | Caddy/Nginx TLS docs and smoke validation |
| Storage credential leakage | Object disclosure/tampering | Env-based secrets, no secrets committed, MinIO profile docs |
| Dependency vulnerability | Supply-chain compromise | CI, npm lockfile, release checklist |

## Non-Goals For Alpha

- Multi-tenant hostile-code isolation.
- Cloud-provider IAM management.
- Formal verification of permission policies.
- Zero-trust secret management.

## Security Direction

- Replace the local function runner with an optional container, microVM, or external job runtime for untrusted code.
- Add signed backups and optional backup encryption.
- Add persistent audit retention policies.
- Add per-route and per-collection metrics labels once cardinality controls exist.
