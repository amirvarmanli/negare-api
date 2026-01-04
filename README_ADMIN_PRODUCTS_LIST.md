# Admin Products List

## Route

`GET /admin/products`

## Purpose

This endpoint powers the admin panel's global products table. It exposes pagination, sorting and filtering over every product, and includes artist metadata so the UI can show the creator without an extra query.

## Query parameters

- `page` (number, default: 1, minimum: 1)
- `limit` (number, default: 20, minimum: 1, maximum: 100)
- `q` (string) – searches product title, slug or numeric id *and* artist display name / username.
- `publishStatus` (enum: `DRAFT`|`PUBLISHED`|`ARCHIVED`)
- `categoryId` (BigInt as string)
- `topicId` (BigInt as string)
- `saleType` (enum: `FREE`|`PAID`|`SUBSCRIPTION`)
- `artistId` (UUID)
- `sortBy` (enum: `createdAt`|`updatedAt`|`price`|`title`, default: `createdAt`)
- `order` (enum: `asc`|`desc`, default: `desc`)

## Bump ordering

Recently bumped products are always prioritized regardless of the requested sort:

1) `pinnedAt` DESC
2) Requested `sortBy` + `order`
3) `id` DESC (stable tie-breaker for pagination)

## Bump endpoint

`POST /admin/products/:id/bump`

Response:

```json
{
  "id": "123",
  "pinnedAt": "2025-03-25T10:15:00.000Z"
}
```

## Why bump is an action

The admin UI treats “نردبان کردن” as a repeatable boost, not a toggle. Each click updates `pinnedAt` so the item resurfaces at the top without needing a persistent pinned state.

## Cover resolution priority

The `coverUrl` field is resolved server-side in this order:

1) Product `coverUrl`
2) First product asset image (`assets[0].url`, ordered by sortOrder/createdAt)
3) `null` when no image exists

## Sample request

```
curl -H "Authorization: Bearer <token>" \
  "{{API_BASE}}/admin/products?page=1&limit=20&publishStatus=PUBLISHED&q=amir"
```

## Sample response

```json
{
  "items": [
    {
      "id": "123",
      "title": "Brand Kit",
      "slug": "brand-kit",
      "publishStatus": "PUBLISHED",
      "pinnedAt": "2025-03-25T10:15:00.000Z",
      "saleType": "PAID",
      "price": 75000,
      "currency": null,
      "coverUrl": "https://cdn.negare.test/products/brand-kit-cover.png",
      "category": {
        "id": "12",
        "title": "Branding"
      },
      "topic": {
        "id": "7",
        "title": "Logos"
      },
      "artist": {
        "id": "artist-user-id",
        "name": "Ali Parsi",
        "avatarUrl": "https://cdn.negare.test/avatar.png"
      },
      "createdAt": "2025-01-01T05:00:00.000Z",
      "updatedAt": "2025-01-02T06:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

## Manual checks

- Verify the route accepts `publishStatus`, `categoryId`, `topicId`, `saleType`, and `artistId` filters, and that each filter returns consistent results when applied from the admin UI or Postman.
- Confirm that the `q` parameter matches product titles, slugs and ids, and that searching for an artist name or username (e.g., `amir`) surfaces their products too.
- Ensure `items` always include `category`, `topic`, and `artist` objects (they can be `null` if absent) with the expected `id`/`title` fields and that `artist` carries `id`, `name`, and `avatarUrl`.
- Check pagination metadata (`meta`) reflects the requested `page`/`limit`, and that `totalPages` is updated when scanning the whole dataset.
- Bump a product multiple times and confirm `pinnedAt` changes each time.
- Confirm bumped items stay on top across filters, search, and pagination.
- Change `sortBy`/`order` and confirm bumped items still lead while secondary ordering respects the chosen preset.
- Send an unknown field in the bump body or list query and confirm the request is rejected by validation.
- Update a product's `publishStatus` via `PATCH /admin/products/:id` and confirm list filters reflect the change.
- Run the Postman "Admin → Products" requests to confirm the newly added examples work against `{{API_BASE}}`.
