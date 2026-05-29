# Hardening Checklist

Use this checklist before exposing OpenBackend outside a trusted LAN.

## Required

- Set strong admin passwords during bootstrap.
- Keep `OPENBACKEND_REQUIRE_AUTH=true`.
- Keep `OPENBACKEND_REQUIRE_WRITE_AUTH=true`.
- Keep `OPENBACKEND_REQUIRE_REALTIME_AUTH=true`.
- Set a restrictive `OPENBACKEND_CORS_ORIGINS` list.
- Put the server behind Caddy or Nginx with valid TLS.
- Rotate default PostgreSQL and MinIO passwords before deployment.
- Store `.env`, backups, and TLS keys outside public web roots.
- Run `npm run backup` before upgrades.
- Run `npm run release:check` before deploying a new version.

## Recommended

- Use PostgreSQL and MinIO for NAS/VPS profiles.
- Restrict dashboard access by VPN, private network, or reverse-proxy allowlist.
- Create API keys per device or kiosk instead of sharing one key.
- Use collection rules for private or admin-only data.
- Keep function code trusted; do not run arbitrary user-submitted functions in alpha.
- Monitor `/metrics`, `/health`, and dashboard audit logs.
- Test restore into a clean directory or staging host.

## Host Controls

- Run the Docker profile as a non-root host user where possible.
- Limit inbound ports to the reverse proxy.
- Enable unattended operating-system security updates.
- Keep Docker, Node.js, PostgreSQL, and MinIO patched.
- Mount backup targets with least privilege.
