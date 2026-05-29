# Release Process

OpenBackend releases use versioned Git tags and a changelog entry for every public build.

## Preflight

```bash
npm run release:check
npm run smoke:docker:local
npm run smoke:docker:nas
npm run smoke:docker:vps
```

If the release includes TLS docs or proxy changes, validate a real hostname:

```bash
OPENBACKEND_TLS_DOMAIN=backend.example.com npm run smoke:tls
```

## Package

1. Update `package.json` and package workspace versions when the release number changes.
2. Add a `CHANGELOG.md` entry with operator-facing changes and migration notes.
3. Confirm `docs/INSTALL.md`, `docs/DEPLOYMENT.md`, and `docs/HARDENING_CHECKLIST.md` match the released behavior.
4. Commit with a Conventional Commit message.
5. Create an annotated tag:

```bash
git tag -a v0.1.0-alpha.0 -m "v0.1.0-alpha.0"
git push origin main --tags
```

## Release Notes Checklist

- State supported deployment profiles.
- State backup/restore compatibility.
- List security-relevant changes.
- List known alpha limitations.
- Confirm no paid cloud account or payment gate is required.
