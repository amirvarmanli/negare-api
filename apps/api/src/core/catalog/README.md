# Catalog Module

This folder documents the rebuilt catalog stack that now mirrors the Prisma schema (`public`, `core`, `catalog`, `analytics`) shipped with the API. The module handles products, taxonomy (categories, tags, topics), social signals (likes, bookmarks, downloads), storage helpers, and the new comments workflow.

## What Changed

- **Products** now expose every schema field (multi-format support, colors, assets, topics, SEO meta, file metadata) plus clean DTO validation and mappers.
- **Taxonomy** (categories, tags, topics) gained CRUD endpoints, cover URLs, and admin-only protection. Topics are a brand-new first-class resource.
- **Social features** (likes, bookmarks, downloads) and profile endpoints use proper auth decorators instead of `any`-based guards.
- **Comments** were implemented end-to-end (authoring, moderation feed, public product thread) with cursor/page pagination.
- **CatalogModule** wires all controllers/services without re-providing Prisma, and storage/counter services remain injectable.

## Testing

1. Ensure a PostgreSQL instance is reachable (e.g., via `docker compose up db`).
2. Run migrations/seeding if needed: `npm run prisma:generate && npm run prisma:migrate:dev`.
3. Execute the catalog e2e suite:
   ```bash
   npx jest apps/api/src/tests/e2e/catalog/catalog.e2e-spec.ts
   ```
   (The suite spins up the Nest app plus Prisma against the test database.)

## Postman Collection

Import `postman/catalog.postman_collection.json` and set a `baseUrl` variable (default `http://localhost:4000`). Authenticated requests rely on the `x-mock-user` header defined at the collection level, so you can switch identities quickly (e.g., admin vs. supplier).

## Swagger

Once `npm run start:dev` is running, open **http://localhost:4000/api/docs** to exercise the rebuilt endpoints with full DTO documentation. Use the built-in “Authorize” dialog or send the `x-mock-user` header (when `MOCK_AUTH_ENABLED` is true) to call protected routes.
