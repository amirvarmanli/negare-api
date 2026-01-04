# Admin My Products List

## Route

`GET /admin/products/mine`

## Purpose

This endpoint powers the "محصولات من" page. It returns only the products owned by the currently authenticated user and does not accept an artist/user filter from the client.

## Query parameters

- `page` (number, default: 1, minimum: 1)
- `limit` (number, default: 20, minimum: 1, maximum: 100)
- `q` (string) – searches product title, slug or numeric id.
- `publishStatus` (enum: `DRAFT`|`PUBLISHED`|`ARCHIVED`)
- `categoryId` (BigInt as string)
- `topicId` (BigInt as string)
- `saleType` (enum: `FREE`|`PAID`|`SUBSCRIPTION`)
- `sortBy` (enum: `createdAt`|`updatedAt`|`price`|`title`, default: `createdAt`)
- `order` (enum: `asc`|`desc`, default: `desc`)

## Cover resolution priority

The `coverUrl` field is resolved server-side in this order:

1) Product `coverUrl`
2) First product asset image (`assets[0].url`, ordered by sortOrder/createdAt)
3) `null` when no image exists

## Sample request

```
curl -H "Authorization: Bearer <token>" \
  "{{API_BASE}}/admin/products/mine?page=1&limit=20&sortBy=createdAt&order=desc"
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

- Verify the route scopes results to the authenticated user without accepting any artist/user id from query params.
- Confirm filters (`publishStatus`, `categoryId`, `topicId`, `saleType`) and sorting behave the same as the global admin list.
- Ensure `items` always include `category`, `topic`, and `artist` objects (they can be `null` if absent) with the expected `id`/`title` fields and that `artist` carries `id`, `name`, and `avatarUrl`.
- Check pagination metadata (`meta`) reflects the requested `page`/`limit`, and that `totalPages` is updated when scanning the whole dataset.
- Run the Postman "Admin → Products → List My Products" request to confirm the example works against `{{API_BASE}}`.
