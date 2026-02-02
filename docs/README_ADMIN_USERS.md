# Admin Users Read-Only Reporting

## Overview
Read-only admin endpoints for listing users and inspecting per-user details with paginated sub-resources. All endpoints are protected by JWT + `PermissionsGuard` and require `admin.users:read`.

## Endpoints

### GET `/admin/users`
Lightweight archive list for admin user management.

Query params:
- `page` (default 1, min 1)
- `limit` (default 20, max 100)
- `q` search across `name`, `username`, `phone`, `email`, `city`
- `role` filter by `RoleName`
- `city` filter by city name
- `sort` = `createdAtDesc|createdAtAsc` (default `createdAtDesc`)
- `from` / `to` ISO date filters on `createdAt`

Response:
```json
{
  "items": [
    {
      "id": "user-uuid",
      "avatarUrl": "https://cdn.example.com/avatar.png",
      "name": "Ali Parsi",
      "username": "ali",
      "phone": "+98912...",
      "email": "ali@example.com",
      "city": "Tehran",
      "role": "user",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "stats": { "purchasesCount": 3, "downloadsCount": 12 }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### GET `/admin/users/:id`
Detailed profile + summary metrics.

Response:
```json
{
  "user": {
    "id": "user-uuid",
    "avatarUrl": null,
    "name": "Ali Parsi",
    "username": "ali",
    "phone": "+98912...",
    "email": "ali@example.com",
    "city": "Tehran",
    "bio": "Illustrator",
    "role": "supplier",
    "skills": [{ "id": "skill-uuid", "title": "Illustration" }],
    "createdAt": "2025-01-01T00:00:00.000Z"
  },
  "financial": {
    "walletBalance": 120000,
    "supplierEarningsTotal": 450000
  },
  "stats": {
    "purchasesCount": 2,
    "downloadsCount": 7,
    "transactionsCount": 3,
    "notificationsCount": 5
  }
}
```

### GET `/admin/users/:id/purchases`
Paginated purchase history (lightweight).

Query params: `page`, `limit`

Response:
```json
{
  "items": [
    {
      "id": "order-uuid",
      "createdAt": "2025-01-02T00:00:00.000Z",
      "total": 45000,
      "paymentStatus": "SUCCESS",
      "products": [{ "id": "12", "title": "Poster Pack" }]
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### GET `/admin/users/:id/downloads`
Paginated download events.

Query params:
- `page` (default 1, min 1)
- `limit` (default 20, max 100)
- `from` / `to` (YYYY-MM-DD, filter by occurredAt in Tehran day range)
- `freeOnly` (boolean, only free downloads)

Response:
```json
{
  "items": [
    {
      "id": "download-uuid",
      "occurredAt": "2025-01-03T10:00:00.000Z",
      "isFree": true,
      "product": { "id": "12", "title": "Poster Pack", "slug": "poster-pack" },
      "ip": "127.0.0.1",
      "userAgent": "Mozilla/5.0"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### GET `/admin/users/:id/transactions`
Paginated wallet/finance transactions (signed amount, localized label).

### GET `/admin/users/:id/notifications`
Paginated notifications (title/body/status).

All sub-resource responses return:
```json
{ "items": [], "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }
```

## Performance Notes
- List endpoint uses `select` with pagination and avoids heavy relations.
- Counts use `count` queries only.
- Heavy collections are exposed via paginated sub-resources.

## Data Model Notes
- `User.name` is the only name field exposed in this admin reporting API.
- Wallet balance is sourced from `finance.wallets.balance` (cached ledger balance).
- Supplier earnings total is aggregated from `finance.order_revenue_splits` + `finance.subscription_supplier_earnings` when the user is a supplier.
