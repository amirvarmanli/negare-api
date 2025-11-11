# Persian Slug Support

This project now accepts, stores, and serves Persian (UTF-8) slugs for Categories, Topics, and Products across both APIs and URLs.

## Normalisation Rules

- All incoming names/titles and slugs are NFC-normalised.
- Arabic ya/kaf (`ي`, `ك`) are converted to Persian `ی`, `ک`.
- Zero-width characters and Arabic full stop are stripped.
- Whitespace collapses to single spaces; slugs replace spaces with `-` and collapse duplicate hyphens.
- Allowed slug characters: `\u0600-\u06FF` (Persian letters), digits `0-9`, Latin letters `a-zA-Z`, and `-`.
- Slugs are clamped to 200 characters and validated via `FA_SLUG_REGEX`.

## Redirect Workflow

- When a slug changes (explicit slug update or implicit rename), a `SlugRedirect` row records `{ entityType, entityId, fromSlug, toSlug }`.
- Incoming `/catalog/{categories|topics|products}/:slug` requests:
  1. `decodeURIComponent` safely (handles double-encoding).
  2. `normalizeFaText` to eliminate look-alikes.
  3. Lookup the entity by slug; if missing, check `SlugRedirect`.
  4. Return `200` with the entity, or `301` with `Location: /catalog/.../<new-slug>`.
- Redirects chain safely (A→B→C) and are unique per `fromSlug` to avoid ambiguity.
- Deleting an entity clears its redirect rows.

## Backfill & Migrations

1. Apply the Prisma migration `20250212000000_fa_slug_support` to add the redirect table, clamp slug columns to 200 chars, and index `categories.parentId`.
2. Run the one-time fixer (after setting `DATABASE_URL`):
   ```bash
   npm run backfill:fa-slugs
   ```
   It normalises existing slugs, generates them from names when missing, and appends numeric suffixes for conflicts.
3. Regenerate Prisma client: `npm run prisma:generate`.

## Testing & Tooling

- Unit tests cover slug utilities plus product-service slug generation/redirects.
- New e2e tests (`apps/api/test/catalog/slug.e2e-spec.ts`) exercise GET-by-slug endpoints with encoded inputs and redirect responses.
- Postman collection: `postman/negare-fa-slug.postman_collection.json`
  - CRUD + slug flows for the three modules.
  - Tests assert 200/201/301/404 scenarios.
- Swagger (`/api/docs`) now documents slug params, notes Persian support, and shows example slugs such as `نقاشی-و-تصویرسازی`.

## Frontend Guidance

- Always use the slug returned by the API verbatim.
- When reading router params, run the equivalent of `decodeURIComponent` once and avoid client-side slug generation.
- Handle HTTP `301` from old slugs by redirecting to `Location`.
- Do not reuse slugs as filesystem/storage keys; treat them as URL identifiers only.
