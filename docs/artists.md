# Artist profiles & follow system

## Prisma
- New relation table `catalog.artist_follows` (composite PK `follower_id`,`artist_id`) with cascade deletes and created_at.
- User sides: `artistFollowings` / `artistFollowers` relations on `core.users`.
- Migration folder: `prisma/migrations/20260301000000_artist_follow`.

## API surface
- `GET /catalog/artists/:id` (public): basic profile (id, displayName/username, avatarUrl, bio) + stats (`productsCount`, `followersCount`, `isFollowedByCurrentUser`) and `topProducts` (brief DTOs).
- `GET /catalog/artists/:id/products` (public): cursor-based list of the artist’s products; supports `limit`, `cursor`, `sort` (`latest|popular|viewed|liked`).
- `POST /catalog/artists/:id/follow` (auth): follow an artist, idempotent; rejects self-follow.
- `DELETE /catalog/artists/:id/follow` (auth): unfollow.
- Only users with role `supplier` or at least one `product_supplier` entry qualify as artists; blocked/pending users are rejected.

## DTOs / Swagger
- DTOs live under `apps/api/src/catalog/artist/dtos/*`; mapped via `ArtistMapper`.
- Swagger tag: `Catalog / Artists` with typed responses (`ArtistProfileDto`, `ProductListResultDto`, `ArtistFollowResponseDto`).

## Postman
- Collection `postman/catalog.postman_collection.json` now includes an **Artists** folder with ready-made calls for profile, products, follow, and unfollow (using `{{artistId}}` + `x-mock-user` headers).

## Testing locally
- Generate client/types: `PATH="/mnt/c/Program Files/nodejs:$PATH" npx prisma generate --schema prisma/schema.prisma`.
- Apply migrations against your DB: `PATH="/mnt/c/Program Files/nodejs:$PATH" PRISMA_MIGRATE_SKIP_SHADOW_DATABASE=1 npx prisma migrate dev --schema prisma/schema.prisma --name artist_follow` (shadow DB may need existing catalogs seeded).
