# TLS Validation

OpenBackend includes Caddy and Nginx reverse-proxy templates:

- `deploy/caddy/Caddyfile`
- `deploy/nginx/openbackend.conf`

## Real-Domain Requirement

Certificate issuance cannot be fully tested on an arbitrary local machine without a real domain whose DNS points to the deployment host and allows inbound HTTP/HTTPS traffic.

To run the real-domain TLS smoke:

1. Point an A/AAAA record at the host.
2. Open ports 80 and 443.
3. Start OpenBackend behind Caddy or Nginx.
4. Run:

```bash
OPENBACKEND_DOMAIN=backend.example.com npm run smoke:tls
```

The script fetches `https://backend.example.com/health` and verifies the OpenBackend health response over TLS.

## Caddy

Caddy can request certificates automatically:

```bash
OPENBACKEND_DOMAIN=backend.example.com TLS_EMAIL=admin@example.com caddy run --config deploy/caddy/Caddyfile
```

## Nginx

Use `deploy/nginx/openbackend.conf` behind your existing certificate automation, such as certbot or a managed reverse proxy.

## Current Test Status

The repository can validate TLS config syntax and provides the real-domain smoke script. A full certificate issuance test requires a domain provided by the operator.

