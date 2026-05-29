# Clean-Room Legal/IP Safety Note

OpenBackend is an independent open-source implementation of a local-first backend platform. It must remain legally and creatively distinct from proprietary backend services.

## Allowed

- Use permissive open-source libraries according to their licenses.
- Read public documentation to understand broad interoperability expectations.
- Study open-source projects for architectural tradeoffs, provided code is not copied unless the license permits it and attribution is retained.
- Implement original APIs with original names, docs, examples, and UI.

## Not Allowed

- Do not reverse engineer proprietary backend services.
- Do not copy proprietary source code, protocol internals, documentation text, UI assets, logos, screenshots, or product names.
- Do not use protected names such as Firestore, Firebase Auth, Cloud Functions, Firebase Storage, Realtime Database, or `initializeApp` in public OpenBackend APIs.
- Do not imply compatibility, sponsorship, or endorsement by any proprietary platform.

## Dependency Handling

- Keep all dependency license files and notices intact.
- Document major dependencies in release notes when they become part of distributed artifacts.
- Prefer permissive components for the core platform.
- Isolate copyleft dependencies, if ever introduced, behind explicit distribution review.

## Public API Naming

OpenBackend public APIs should use original naming. Current examples:

- `createOpenBackend`
- `app.database()`
- `db.collection("users")`
- `collection.create(data)`
- `collection.watch(callback)`

These names describe the product plainly without copying proprietary product identity.

