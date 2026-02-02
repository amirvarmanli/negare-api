# Admin Credits

## Route

`GET /admin/credits`

## Purpose

This endpoint powers the admin credits/earnings ledger. It reports supplier earnings from product purchases and subscription revenue pools. It is reporting-only and does not imply settlement or payout status.

## Query parameters

- `page` (number, default: 1, minimum: 1)
- `limit` (number, default: 20, minimum: 1, maximum: 100)
- `type` (enum: `PRODUCT_PURCHASE`|`SUBSCRIPTION_PURCHASE`)
- `q` (string) – searches supplier name/phone/email and product title. Subscription rows only match supplier fields.
- `supplierId` (UUID) – filters rows belonging to a specific supplier
- `from` (ISO date) – filters `createdAt` from this timestamp.
- `to` (ISO date) – filters `createdAt` up to this timestamp.

## Sorting

Credits are sorted by `createdAt` desc with a stable `id` desc tie-breaker.

## Response shape

```json
{
  "items": [
    {
      "id": "credit-uuid",
      "createdAt": "2025-01-01T12:00:00.000Z",
      "type": "PRODUCT_PURCHASE",
      "supplier": {
        "id": "user-uuid",
        "fullName": "Ali Parsi",
        "phone": "09120000000",
        "email": "ali@example.com",
        "avatarUrl": "https://cdn.example.com/avatar.png"
      },
      "amount": { "total": 175000 },
      "product": { "id": "1024", "title": "Premium Pack" }
    },
    {
      "id": "credit-uuid-2",
      "createdAt": "2025-02-01T12:00:00.000Z",
      "type": "SUBSCRIPTION_PURCHASE",
      "supplier": {
        "id": "user-uuid",
        "fullName": "Ali Parsi",
        "phone": "09120000000",
        "email": "ali@example.com",
        "avatarUrl": "https://cdn.example.com/avatar.png"
      },
      "amount": { "total": 95000 },
      "subscription": { "title": "Subscription pool 2025-02-01 - 2025-02-28" }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

## Sample request

```bash
curl -H "Authorization: Bearer <token>" \
  "{{API_BASE}}/admin/credits?page=1&limit=20&type=PRODUCT_PURCHASE&q=ali&from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.999Z"
```

## Notes

- This endpoint is reporting-only. It does not expose settlement, payout, paidAt, or any payment identifiers.
- Subscription titles are derived from the subscription revenue pool period because earnings do not store a plan title.
