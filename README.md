# Negare API

Backend for the Negare marketplace built with NestJS, TypeORM, PostgreSQL, and Next.js on the frontend. This document highlights the latest catalog engagement changes and how to operate the project.

## Recent Changes — Split Likes & Bookmarks

- Introduced dedicated `content.likes` and `content.bookmarks` tables with TypeORM entities and migrations.
- Likes now drive the public `products.likesCount` counter, while bookmarks remain private per user.
- Added `/catalog/products/:id/like` and `/catalog/products/:id/bookmark` toggle endpoints with idempotent behaviour.
- Exposed profile feeds `/profile/likes` and `/profile/bookmarks` alongside existing downloads, purchases, and follow endpoints.
- Product detail responses now include per-user `liked` and `bookmarked` flags when a user is authenticated.
- Published Postman collection `postman/Catalog_Profile.postman_collection.json` covering catalog, profile, downloads, and follow flows.

## Data Model & Migration Notes

- `content.favorites` is renamed to `content.bookmarks`; constraints were updated accordingly.
- New `content.likes` table stores `(user_id, product_id)` pairs with a composite PK and an index on `product_id`.
- Migration `1730000000000-SplitLikesBookmarks.ts` copies existing favorite rows into the likes table, clears bookmarks, and backfills `products.likes_count`.
- Running the migration sequence:
  ```bash
  npm run typeorm:migration:run
  ```
  Rollback uses the down script but will merge bookmarks back into the legacy `favorites` table.

## Development Workflow

Install dependencies and start the server:

```bash
npm install
npm run start:dev
```

Unit tests cover counters, likes, bookmarks, and product decoration logic:

```bash
npm test
```

## Product Detail Response

- `GET /catalog/products/:idOrSlug` returns the product entity extended with `liked` and `bookmarked` booleans when the requester is authenticated.
- Anonymous requests receive the same payload with both flags set to `false`.
- View tracking and analytics updates remain unchanged.

## API Collections

- Import `postman/Catalog_Profile.postman_collection.json` to exercise catalog listing, product detail, like/bookmark toggles, downloads, profile histories, and supplier follow flows.
- Collection variables:
  - `baseUrl` – API root (defaults to `http://localhost:3000/api`).
  - `productId`, `supplierId` – sample identifiers for quick testing.
  - `accessToken`, `refreshToken` – JWT and refresh cookie values for authenticated calls.

## Additional Commands

- Generate new migrations: `npm run typeorm:migration:generate -- <MigrationName>`
- Apply migrations: `npm run typeorm:migration:run`
- Linting / formatting follow the project’s ESLint and Prettier configuration (run via `npm run lint` when available).

---

For architectural details, refer to the source under `src/catalog`, `src/core`, and the respective DTO/service implementations added in this update.
