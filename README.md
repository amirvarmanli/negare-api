# Negare API

## Blog & Newsletter Platform

- **Modules**: `BlogModule` and `NewsletterModule` expose fully documented REST endpoints under `/api/blog/...` and `/api/newsletter/...` plus admin routes under `/api/admin/...`. Both modules rely on the shared `PrismaService`, DTO validation (`class-validator`), Swagger docs, and the existing auth guard (decorate GET routes with `@Public()` and require `Authorization: Bearer` for admin/comment mutations).
- **Prisma models**:  
  - `BlogCategory`, `BlogPost`, `BlogComment`  
  - `NewsletterCategory`, `NewsletterIssue`, `NewsletterComment`  
  All IDs are UUIDs, slugs are unique `citext`, categories support optional parents, publication status comes from the shared `PublicationStatus` enum, and comment moderation uses `CommentStatus`. Blog posts and newsletter issues expose both `isFeatured` and `isPinned` flags (only one item per module can be pinned at a time). Newsletter issues also support an optional `fileUrl` for downloadable attachments.
- **Migrations**: after pulling the schema changes run  
  ```bash
  npx prisma migrate dev --name blog_newsletter_pins --schema prisma/schema.prisma
  ```  
  or `npx prisma migrate deploy` in CI/CD. Regenerate the Prisma client (`npm run prisma:gen`) before compiling NestJS.
- **Running locally**: ensure `DATABASE_URL` is set, then `npm run start:dev` (or `npm run start` after building). Swagger auto-docs show everything at `http://localhost:4000/api/docs`.
- **Key endpoints**:
  - Blog public: `GET /api/blog/posts`, `GET /api/blog/posts/:slug`, `GET /api/blog/posts/:slug/comments`, `GET /api/blog/categories`, `GET /api/blog/categories/all`
  - Blog admin: `POST|PATCH|DELETE /api/admin/blog/posts`, `POST /api/blog/posts/:id/comments`, `PATCH /api/admin/blog/comments/:id`, category CRUD under `/api/admin/blog/categories`, and pin management via `POST /api/admin/blog/posts/:id/pin`
- Newsletter public: `GET /api/newsletter/issues`, `GET /api/newsletter/issues/:slug`, `GET /api/newsletter/issues/:slug/comments`, `GET /api/newsletter/categories`, `GET /api/newsletter/categories/all`
- Newsletter admin: mirror the blog admin routes under `/api/admin/newsletter/...` with pinning exposed through `POST /api/admin/newsletter/issues/:id/pin`
- **Postman collection**: `postman/blog-newsletter.postman_collection.json` contains ready-made requests (uses `{{baseUrl}}` + `{{accessToken}}` variables). Import it to exercise both public & admin APIs quickly.
### Blog & Newsletter Public Endpoints
- **Endpoints**: use `/api/blog/posts` and `/api/newsletter/issues` (plus their slug/comment/category helpers under `/api/blog/...` and `/api/newsletter/...`) for public consumption; admin routes live under `/api/admin/blog/...` and `/api/admin/newsletter/...` for suppliers/admins.
- **Public visibility rules**: only `PublicationStatus.PUBLISHED` items are returned, and when `publishedAt` is set it must be `<= now`; drafts, future-scheduled drafts, or soft-deleted rows never show up.
- **Query filtering behavior**: pagination (`page`, `limit`), category slug, search (`q`), and the optional `supplierId` (UUID) query let the storefront narrow results to a specific supplier/author; omit `supplierId` to get every published item.
- **Testing via Postman**: import `postman/blog-newsletter.postman_collection.json`, point `{{baseUrl}}` at your API, supply a valid `{{accessToken}}`, and optionally set `{{supplierId}}` to test owner-scoped listings.
- **Common pitfalls**: remember to publish drafts (`status=PUBLISHED`) and set `publishedAt` to the past (or leave it `null`) before calling the public endpoint, otherwise the visibility filter drops the payload.
### Routes & Testing
- **Supplier/admin panel**: `/api/admin/blog/posts`, `GET /api/admin/blog/posts/{id}` (UUID) for the new supplier panel links, and `GET /api/admin/blog/posts/slug/{slug}` for legacy permalinks let suppliers list, fetch, create, edit, and soft-delete only their own content while admins can manage everything. Suppliers can only read posts where `authorId` matches their account (`CurrentUser.id`), admins bypass that guard, and forbidden lookups return `404` to keep ownership private.
- Panel cards now link to `/panel/supplier/blogs/${post.id}` so the edit view resolves via ID-first navigation while the slug path remains a Persian-friendly fallback for older routes. Do not rely on a single `GET /api/admin/blog/posts/:token` handler for both IDs and slugs, because Persian or UUID-like slugs can collide; the explicit `/slug/{slug}` segment removes that ambiguity.
- **Supplier/admin newsletter panel**: `/api/admin/newsletter/issues/{id}` is the ID-first endpoint used by `/panel/supplier/newsletter/${issue.id}` while `/api/admin/newsletter/issues/slug/{slug}` stays as a legacy fallback (Persian/Unicode values are supported). Admins can read every issue, but suppliers only succeed when `authorId === CurrentUser.id`, and denied lookups emit `404` so ownership remains private. Do not collapse both behaviors into a single `:token` handler—UUID-like slugs can collide, and the dedicated `/slug/{slug}` segment keeps the routes unambiguous.
- **Testing**: import `postman/blog-newsletter.postman_collection.json`, point `{{baseUrl}}` at your running API, populate `{{accessToken}}` with an authenticated supplier/admin token, then run the public list/single, the admin list, the `Get ... (Admin)` slug fetches, and the create/update/delete requests to verify end-to-end behavior.
- **Environment**: reuse the existing `.env` knobs (`DATABASE_URL`, `GLOBAL_PREFIX`, JWT secrets, etc.). Admin endpoints expect an authenticated JWT user so provide a valid `Authorization: Bearer <token>` header when testing.

## Artist profiles & follows

- Artist profiles expose bio/avatar, product & follower counts, and top products.
- Follow/unfollow endpoints live under `/catalog/artists/:id/follow` and enforce supplier eligibility + self-follow guards.
- See `docs/artists.md` for Prisma notes, endpoints, and Postman samples.

### Public slug/handle-based artist profile

- `GET /api/catalog/artists/public/by-slug/:slug` returns `ArtistPublicProfileDto` (id, slug, displayName, username/avatar/bio, skills list, productsCount, followersCount). It lets the frontend hydrate `/artists/[slug]` without requiring the viewer to be authenticated or aware of the artist ID.
- `GET /api/catalog/artists/public/by-handle/:handle` also returns `ArtistPublicProfileDto`. `handle` can be either the artist slug or their username (case-insensitive), so older records without slugs continue to resolve via `/artists/:username`.
- Example:
  ```bash
  curl -s -H 'Accept: application/json' \\
    http://localhost:4000/api/catalog/artists/public/by-handle/negare_artist
  ```
- Postman helpers live in `postman/negare-catalog-artists.postman_collection.json` (includes both the success and 404 examples for slug + handle paths).

## Persian Slug Support

## Catalog Product Short Links, Files & Topics

- Product short links are now numeric-friendly (`p/xxxxxx` by default). When `shortLink` is omitted the service creates a six-digit code with collision retries inside the Prisma transaction (`ProductService.resolveShortLink`). Custom values (≤32 chars) are still accepted when unique and can be updated via PATCH.
- `catalog.product_files` now carries `product_id` plus an optional uploaded `file_id` (UUID → `core.files`). Migration `20251201000000_product_file_links` backfills existing rows, enforces a one-to-one constraint per product, and removes the legacy `products.file_id` column.
- Product create/update flows link uploaded files via the new UUID-based `fileId` parameter or keep supporting inline payloads. The helper (`resolveFileInstruction` + `applyFileInstruction`) runs inside the surrounding transaction so `ProductFile` never lags behind a product mutation.
- Detail responses expose the upload UUID via `ProductDetailDto.fileId` / `ProductFileDto.fileId`, `ProductTopicDto` now includes a `topicId` field alongside `id`, and `graphicFormats`/`topics` are emitted as the frontend expects to pre-populate edit forms.
- Postman (`postman/catalog.postman_collection.json`) documents the new `{{uploadedFileId}}` variable, short-link behaviour, and shows how to disconnect (`fileId: null`) or swap the main file.
- If Prisma reports that `20251201000000_product_file_links` previously failed (P3009), mark it as rolled back and redeploy:  
  ```bash
  npx prisma migrate resolve --rolled-back 20251201000000_product_file_links --schema prisma/schema.prisma
  npx prisma migrate deploy --schema prisma/schema.prisma
  ```

## Home products / product cards

- The home-feed listings and catalog product cards now return `creatorUsername` (`string | null`) in addition to the existing `creatorName`, so clients can surface both the display name and the username without extra lookups.

## Product Related & Search

- `GET /api/catalog/products/:id/related` returns products sharing at least one tag with the source product, ordered by overlap count and `createdAt` (default 12 items, max 24).
- `GET /api/catalog/products/search?q=...` searches titles, descriptions, and tag names with pagination (`page`, `limit≤50`) while keeping the existing catalog filters for category, tag, topic, pricingType, etc.; relevance favours title prefix matches, then titles, tag names, descriptions, and recency.
- Both endpoints observe the same published visibility rules as product detail/listing, are exposed in Swagger, and ship with ready-made Postman requests in `postman/catalog.postman_collection.json`.

## Product Likes & Bookmarks

- Product DTOs now surface `isLikedByCurrentUser` and `isBookmarkedByCurrentUser` (set when the requester is authenticated) across detail, list, search, and related endpoints.
- Toggle endpoints return useful payloads: `POST /catalog/products/:id/like` ⇒ `{ productId, liked, likesCount }`, `POST /catalog/products/:id/bookmark` ⇒ `{ productId, bookmarked }`.
- New paginated endpoints for the current user: `GET /catalog/products/liked` and `GET /catalog/products/bookmarked` with `page`/`limit` (max 50), returning the standard product card DTO plus user reaction flags.



- Categories, topics, and products now accept Persian (UTF-8) slugs with NFC normalisation, Arabic→Persian character fixes, and zero-width stripping.
- `/catalog/{categories|topics|products}/:slug` endpoints decode, normalise, and either return `200` or emit a `301` redirect when a slug changes (see `docs/fa-slug-support.md`).
- Prisma migration `20250212000000_fa_slug_support` introduces the `SlugRedirect` table, clamps slug columns to 200 chars, and indexes `parentId`.
- Backfill existing slugs with `npm run backfill:fa-slugs`.
- Postman collection `postman/negare-fa-slug.postman_collection.json` exercises CRUD + slug flows (with assertions for 200/201/301/404).
- New e2e tests at `apps/api/test/catalog/slug.e2e-spec.ts` cover encoded Persian slugs and redirect semantics.

## Hardened Auth & Token Platform

The authentication layer now guarantees hop-by-hop security for both CSR and SSR clients. Key traits:

- Username / email / phone login issues an access token (response body) and a refresh token stored **only** in an HttpOnly cookie (default `Path=/api/auth/refresh`, `SameSite` / `Secure` derived from env).
- Refresh tokens rotate on every call: the previous JTI is blacklisted, the new JTI is linked to the same session, and the cookie is reissued.
- Sessions live in Redis with per-user sets, sorted indices, and reverse JTI lookups for revoke/touch flows.
- `/auth/refresh` is marked `@Public()`, enforces JSON requests + allowed Origins, is rate-limited via Redis, and emits trace-aware logs for allow-list hits/misses.
- Logout clears the refresh cookie on the configured path, blacklists the supplied JTI, and tears down the Redis session.
- Swagger exposes both `Bearer` and cookie auth schemes; the Postman collection mirrors the same behaviour for local testing.

## Login → Refresh → Logout (happy path)

```text
Login (identifier + password)
  ├─ PasswordService.login → userId
  ├─ SessionService.create(userId, ip, userAgent) → sid
  ├─ RefreshService.issueTokensForUserId(userId, { sessionId: sid })
  │     ├─ TokenService.signAccess + signRefresh (HS256)
  │     ├─ Redis allow-list key auth:refresh:allow:<jti>
  │     └─ SessionService.linkRefreshJti(userId, sid, jti)
  └─ Set-Cookie refresh_token=…; HttpOnly; SameSite (env); Path=/api/auth/refresh

Refresh (cookie only)
  ├─ Controller enforces JSON body, allowed Origin/Referer, and Redis-backed rate-limit
  ├─ RefreshService.refresh(refreshToken)
  │     ├─ validate allow-list + blacklist old jti
  │     ├─ SessionService.unlinkRefreshJti(sub, sid, oldJti)
  │     └─ mint new pair + relink session
  └─ Set-Cookie refresh_token=…; HttpOnly; Path=/api/auth/refresh

Logout
  ├─ RefreshService.peekPayload(refresh, ignoreExp=true)
  ├─ RefreshService.revoke(refresh)
  │     ├─ blacklist jti
  │     └─ unlink session ↔ jti
  ├─ SessionService.revoke(sub, sid)
  └─ Clear refresh cookie on configured path (`COOKIE_REFRESH_PATH`)

## Refresh Endpoint Hardening

- `/api/auth/refresh` is explicitly annotated with `@Public()`, so the HybridAuth guard skips it while the controller performs its own checks.
- Only `POST` requests with `Content-Type: application/json` are accepted; `Origin` and `Referer` must match `FRONTEND_URL`, otherwise the call is rejected with `403 OriginNotAllowed`.
- A Redis-backed rate limiter (`RefreshRateLimitService`) guards brute-force attempts (defaults: `REFRESH_RL_MAX=5` requests per `REFRESH_RL_WINDOW=10s`, keyed by IP + User-Agent).
- Each call consumes the allow-list entry, blacklists the old JTI, relinks the session/JTI pair, and issues a fresh cookie:  
  `Set-Cookie: refresh_token=...; HttpOnly; SameSite=<env>; Secure=<env>; Path=/api/auth/refresh`.
- Missing cookies produce `401 No refresh cookie`; reusing a rotated cookie immediately hits the allow-list miss path (401) and leaves the old JTI blacklisted.
- CORS is pinned to `FRONTEND_URL` with `credentials: true`, and `app.set('trust proxy', 1)` ensures `req.secure` works behind HTTPS terminators.
- Trace-aware logs capture cookie presence, `{ sub, sid, jti }`, allow-list hits/misses, and rotation outcomes to simplify debugging across pods.

### Manual Verification

1. Login → inspect the first `Set-Cookie` header. It must include `HttpOnly`, `Path=/api/auth/refresh`, `SameSite=Lax` in dev (or `None` in prod), and `Secure` only when HTTPS is enabled.
2. `curl -i -X POST http://localhost:4000/api/auth/refresh \`  
   `     -H "Origin: http://localhost:3000" \`  
   `     -H "Content-Type: application/json" \`  
   `     -H "Cookie: refresh_token=<PASTE_TOKEN>"`  
   returns `200` with body `{ "success": true, "data": { "accessToken": "..." } }` plus a brand-new `refresh_token` cookie.
3. Reuse the old cookie after rotation → `401 { code: "InvalidRefresh" }`.
4. Omit the cookie entirely → `401 { code: "MissingRefresh" }`.
5. Spoof the `Origin`/`Referer` or send a non-JSON body → expect `403 OriginNotAllowed` or `400 InvalidContentType`.
```

## SSR vs CSR clients

- **CSR (Next.js client components)** use the access token in memory/`Authorization` headers and delegate refresh/logout to the cookie-aware endpoints above.
- **SSR (Next.js route handlers/pages)** simply forward the browser cookies. No server-side refresh calls are needed; render requests must opt into `cache: 'no-store'`.
- Optional proxy route: expose `/api/auth/refresh` via a Next.js Route Handler that forwards the cookie and propagates the `Set-Cookie` response headers.
- Never place the access token in cookies or `localStorage`; short-lived tokens live in process memory only.

## Environment Quick Start

Core `.env` knobs (see `.env.example`):

- `ACCESS_JWT_SECRET` / `REFRESH_JWT_SECRET` & matching `*_EXPIRES` durations (`10m`, `30d`, etc.).
- `COOKIE_SAMESITE`, `COOKIE_SECURE`, `COOKIE_REFRESH_PATH=/api/auth/refresh`, `COOKIE_ACCESS_PATH=/`.
- `GLOBAL_PREFIX=api`, `FRONTEND_URL=http://localhost:3000` (used for both CORS + Origin enforcement), `CORS_ORIGIN` (legacy fallback), `REDIS_URL=redis://localhost:6379`.
- Refresh throttling knobs: `REFRESH_RL_MAX` (default 5) and `REFRESH_RL_WINDOW` (default 10s).
- Production: set `COOKIE_SECURE=true` and `COOKIE_SAMESITE=none` once the API is served over HTTPS.

## Docker workflow

### Starting and stopping

- `docker compose up -d --build` compiles the Nest app, brings up Postgres, Redis, and the API, and runs `prisma generate` + `prisma migrate deploy` before the server listens.
- The stack exposes `http://localhost:4000/${GLOBAL_PREFIX:-api}` (API) and `http://localhost:8080` (Adminer when you run `docker compose --profile tools up -d adminer`).
- Use `docker compose down -v` to stop the stack and wipe the persisted Postgres data/temporary uploads.
- The dev override (`docker-compose.override.yml`) mounts the repository, pins a dedicated `api-node-modules` volume for Windows hosts, and switches the command to `npm run start:dev`, so `docker compose up -d` already runs Nest in watch mode.

### Prisma, pgcrypto, and schemas

- The entrypoint automatically executes `npm run prisma:generate` followed by `npm run prisma:migrate:deploy`, so `docker compose up -d` keeps Prisma aligned with the migration history.
- Run `docker compose exec api npm run prisma:migrate:deploy` if you need to reapply migrations after editing `.env` or the Prisma schema.
- Postgres initialization scripts under `docker/db-init/init.sql` enable `pgcrypto` and create the `analytics`, `catalog`, `core`, `finance`, and `public` schemas that Prisma expects, so migrations never fail due to missing schemas.

### Seeding subscription plans

- The compiled seed script lives at `dist/scripts/seed-subscription-plans.js`, so run `docker compose exec api node dist/scripts/seed-subscription-plans.js` whenever you need to refresh the finance subscription plans.
- Setting `RUN_SEED=true` in `.env` (or appending `RUN_SEED=true docker compose up -d`) makes the entrypoint run the script right after migrations finish, keeping the behaviour safe for repeated starts.

### Troubleshooting

- Ensure `DATABASE_URL` inside the container points at `postgresql://postgres:postgres@db:5432/negare_db`; the newly added `.env.example` documents both the local and Docker connection strings.
- The entrypoint prints `Waiting for Postgres…` until `pg_isready` reports healthy; inspect `docker compose logs db` if that loop never completes.
- Redis is required for auth/refresh throttling; check `docker compose logs redis` if the API cannot establish sessions.
- The API exposes `/api/health` (global prefix respects `GLOBAL_PREFIX`) and the healthcheck returns success via `curl`. Use `docker compose ps` to confirm the service status once the endpoint responds.

## Running & Testing

```bash
npm run start:dev        # local API (http://localhost:4000/api)
npm run test             # unit tests (TokenService, RefreshService, SessionService, AuthController)
npm run test:e2e         # end-to-end auth cookie/token rotation checks
npm run test:cov         # full coverage report (HTML + lcov)
```

All tests assume Redis is available — the suite boots against an in-memory fake Redis used by the services.

Key coverage:

- `apps/api/test/auth/auth.e2e.spec.ts` — legacy login/profile smoke tests.
- `apps/api/test/auth/auth.refresh.e2e.spec.ts` — refresh cookie issuance, allow-list rotation, concurrency failures, malformed Redis entries, session mismatch, cookie-flag assertions for dev/prod, and Origin enforcement.

## Upload Module

The chunked upload pipeline lives under `apps/api/src/core/upload` and now includes:

- Server-confirmed progress: `receivedBytes`/`percent` are derived from persisted chunks, and `GET /upload/status` exposes `missingIndexes` so the client only retries gaps.
- Resumable controls: `/upload/pause` keeps the temp file + state intact, `/upload/resume` re-opens the session, and `/upload/abort` still performs a full cleanup.
- Integrity toggles: per-chunk SHA-256 is accepted via the `sha256` query (required when `UPLOAD_INTEGRITY_CHUNK=required`) and `/upload/finish` verifies the final hash when `sha256` is provided or `UPLOAD_INTEGRITY_FILE` demands it.
- Strict allow-lists sourced from ENV (extensions + MIME, including the Negare-specific set for design/video/font assets). Incoming extensions such as `mvk` are normalised to `mkv` server-side.
- Swagger is updated for every endpoint and the Postman collection (`postman/UploadModule.postman_collection.json`) now covers init → chunk → status → pause/resume → finish/abort.

### cURL smoke-test

```bash
# 1) init
curl -s -X POST "${BASE_URL}/upload/init" \
     -H 'Content-Type: application/json' \
     -d '{"filename":"poster.ai","size":5242880,"mime":"application/postscript","sha256":"'"${FINAL_SHA}"'"}'

# 2) stream chunk 0 (5 MB) with per-chunk hash when enabled
tail -c 5242880 poster.ai | \
  curl -s -X POST "${BASE_URL}/upload/chunk?uploadId=${UPLOAD_ID}&index=0&sha256=${CHUNK_SHA}" \
       -H 'Content-Type: application/octet-stream' --data-binary @-

# 3) poll status (returns receivedBytes + missingIndexes)
curl -s "${BASE_URL}/upload/status?uploadId=${UPLOAD_ID}"

# 4) pause / resume when the UI needs to stop
curl -s -X POST "${BASE_URL}/upload/pause" \
     -H 'Content-Type: application/json' \
     -d '{"uploadId":"'"${UPLOAD_ID}"'"}'
curl -s -X POST "${BASE_URL}/upload/resume" \
     -H 'Content-Type: application/json' \
     -d '{"uploadId":"'"${UPLOAD_ID}"'"}'

# 5) finish (verifies final hash when supplied / required)
curl -s -X POST "${BASE_URL}/upload/finish" \
     -H 'Content-Type: application/json' \
     -d '{"uploadId":"'"${UPLOAD_ID}"'","subdir":"uploads","sha256":"'"${FINAL_SHA}"'"}'

# 6) abort (cleans temp file + Redis state)
curl -s -X POST "${BASE_URL}/upload/abort?uploadId=${UPLOAD_ID}"
```

### Upload ENV knobs

- `UPLOAD_TMP_DIR`, `UPLOAD_CHUNK_SIZE`, `UPLOAD_TTL_SECONDS`, `UPLOAD_MAX_SIZE_BYTES`, `UPLOAD_CLEAN_INTERVAL_MIN`, `UPLOAD_MAX_TEMP_AGE_HOURS` – storage/TTL tuning.
- `ALLOWED_EXTS` / `ALLOWED_MIME` – defaulted to Negare’s allow-list (`rar, zip, pdf, ai, eps, svg, psd, cdr, aep, png, jpg, jpeg, webp, ttf, otf, woff, woff2, mp4, mkv` plus matching MIME types).
- `UPLOAD_INTEGRITY_CHUNK` (`off|optional|required`) and `UPLOAD_INTEGRITY_FILE` (`off|optional|required`) – gate per-chunk and final SHA-256 verification.
- `FTP_*`, `FILE_PUBLIC_BASE_URL`, `UPLOAD_PUBLIC_SUBDIR`, `UPLOAD_BASE_DIR` – pluggable storage driver settings (FTP today, S3/others can plug into `StorageDriver`).

## Docs & Tooling

- Swagger: `http://localhost:4000/api/docs` (`Bearer` + cookie auth enabled).
- Postman collection: `postman/auth.postman_collection.json` (login, refresh, logout, profile) with environment variables `baseUrl`, `GLOBAL_PREFIX`, and `accessToken`.
- Example cURL probes:
  ```bash
  curl -i -X POST http://localhost:4000/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"identifier":"negare_user","password":"Password!1"}'

  curl -i -X POST http://localhost:4000/api/auth/refresh \
       -H "Origin: http://localhost:3000" \
       -H "Content-Type: application/json" \
       -H "Cookie: refresh_token=<TOKEN>" \
       -d '{}'
  ```

## Production Notes

- Configure your reverse proxy to forward `X-Forwarded-*` headers; Nest is already set to trust proxies in production.
- Serve over HTTPS so `COOKIE_SECURE=true` can be enforced; combine with `SameSite=None` for cross-site SSR fetches.
- Redis keys in play:
  - `auth:refresh:allow:<jti>` – refresh allow-list with TTL = refresh token TTL.
  - `auth:session:*` – session registry, bidirectional jti ↔ sid lookups, and paginated indices.
  - `auth:rbl:<jti>` – refresh blacklist managed by `TokenService`.

Together these changes bring the NestJS API in line with Next.js 15 SSR + CSR expectations while maintaining secure, single-use refresh tokens.
