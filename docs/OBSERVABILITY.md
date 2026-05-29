# Observability

OpenBackend keeps observability local-first and dependency-free.

## Health

`GET /health` returns service identity, version, deploy size, storage/database drivers, uptime, and auth posture.

Example fields:

- `ok`
- `version`
- `mode`
- `database`
- `storage`
- `uptimeSeconds`
- `authRequired`
- `writeAuthRequired`
- `realtimeAuthRequired`

## Metrics

`GET /metrics` returns a JSON counter snapshot suitable for simple uptime checks. Admin users can also call `GET /api/admin/metrics`.

Current counters:

- `requestsTotal`
- `errorsTotal`
- `rateLimitedTotal`
- `documentsWrittenTotal`
- `filesWrittenTotal`
- `functionsRunTotal`
- `auditEventsTotal`

## Logs

The server emits one structured JSON log line per request:

```json
{"level":"info","event":"request.completed","service":"openbackend-server","method":"GET","path":"/health","status":200,"durationMs":2}
```

Warnings and errors use the same format.

## Audit Logs

Security-relevant actions are written to the `audit_logs` collection and are visible in the dashboard. Admin clients can call `GET /api/admin/audit-logs`.

Audited actions include document writes, user creation, API key creation, file writes/deletes, function runs, import operations, and permission changes.
