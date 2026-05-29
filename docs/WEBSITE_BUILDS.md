# Website Builds

OpenBackend is for website builds too: static sites, Vite/React apps, agency client sites, landing pages with contact forms, portfolios, content sites, and small client portals.

## One-Button Backend

```bash
npm run deploy -- local
```

That gives a website builder:

- Local content collections.
- Contact form submissions.
- File uploads.
- Realtime preview for admin/editor screens.
- Self-hosted auth for admin-only writes.
- API keys for trusted server-side form handlers or build scripts.
- No required cloud account, subscription, or paid tier gate.

## Website Patterns

| Website need | OpenBackend feature | Notes |
| --- | --- | --- |
| Blog or CMS content | `posts`, `pages`, `nav_items` collections | Read publicly, write with admin session/API key |
| Contact forms | `contact_messages` collection | Use server/API-key write path for production |
| Media library | filesystem storage now, MinIO later | Local disk/NAS friendly |
| Live preview | collection `watch` | Useful for local admin/editor UIs |
| Client portal | auth sessions and document collections | Add roles before broad production use |
| Build-time content | SDK from Node build scripts | Use API key in env, never public client bundle |

## Recommended Website Setup

1. Start OpenBackend.

   ```bash
   npm run deploy -- local
   ```

2. Bootstrap an admin in the dashboard.
3. Create an API key named for the website, such as `client-site-build`.
4. Add the API key to the website environment for server-side writes.
5. Keep public browser reads unauthenticated unless the site is private.

## Security Notes

- Do not put admin session tokens in public website bundles.
- Do not put long-lived API keys in client-side JavaScript.
- For pure static hosting, route form submissions through a tiny server function, edge handler, or self-hosted form endpoint that owns the API key.
- For local preview, it is fine to use `OPENBACKEND_REQUIRE_WRITE_AUTH=false`; production should keep it enabled.

## Example

Run the included website example:

```bash
npm run dev:website
```

The example reads public posts and submits contact messages using an API key field so website builders can see the production-safe shape.
