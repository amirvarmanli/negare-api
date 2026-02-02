# Admin Purchases

## Route

`GET /admin/purchases`

## Purpose

This endpoint powers the admin purchases/orders table. It returns order rows with buyer, product, payment summary, and pagination metadata.

## Query parameters

- `page` (number, default: 1, minimum: 1)
- `limit` (number, default: 20, minimum: 1, maximum: 100)
- `status` (enum: `SUCCESS`|`PENDING`|`FAILED`)
- `q` (string) – searches buyer name/phone/email, order id, and payment track/ref ids.
- `from` (ISO date) – filters `createdAt` from this timestamp.
- `to` (ISO date) – filters `createdAt` up to this timestamp.

## Sorting

Orders are sorted by `createdAt` desc with a stable `id` desc tie-breaker.

## Payment status mapping

Mapping is derived from the latest payment (by `createdAt` desc):

- `SUCCESS` → `FinancePaymentStatus.SUCCESS`
- `PENDING` → `FinancePaymentStatus.PENDING` or no payment yet
- `FAILED` → `FinancePaymentStatus.FAILED` or `FinancePaymentStatus.CANCELED`

## Sample request

```bash
curl -H "Authorization: Bearer <token>" \
  "{{API_BASE}}/admin/purchases?page=1&limit=20&status=SUCCESS&q=amir&from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.999Z"
```

## Sample response

```json
{
  "items": [
    {
      "orderId": "order-uuid",
      "createdAt": "2025-01-01T12:00:00.000Z",
      "buyer": {
        "id": "user-uuid",
        "fullName": "Ali Parsi",
        "phone": "09120000000",
        "email": "ali@example.com"
      },
      "products": [
        { "id": "1024", "title": "Premium Pack" }
      ],
      "amount": {
        "total": 250000
      },
      "paymentStatus": "SUCCESS",
      "payment": {
        "id": "payment-uuid",
        "provider": "ZIBAL",
        "trackId": "track-123",
        "refId": "ref-123"
      }
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
