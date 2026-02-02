# Finance Support Features

This document covers the donation flow, purchased-product awareness, free download limits, and download event reporting.

## Architecture Decisions
- Donations are stored as first-class records in the finance schema and are tied to a gateway payment via `referenceId`.
- Donation payments reuse the existing gateway integration and verification flow to avoid duplicating gateway logic.
- Purchased-product awareness is driven by finance entitlements to avoid N+1 lookups and keep results user-specific.
- Free downloads are gated by the finance downloads service with daily quotas (per user, per day) and return a signed URL when available.
- Every successful download is logged in `finance.download_events` with metadata for admin reporting.

## Database Changes
- New enum: `finance.finance_donation_status_enum` with `PENDING`, `SUCCESS`, `FAILED`.
- New table: `finance.donations`
  - `id` (UUID, PK)
  - `user_id` (UUID, nullable)
  - `amount` (INTEGER, TOMAN)
  - `status` (donation status enum)
  - `gateway_track_id` (VARCHAR)
  - `reference_id` (VARCHAR)
  - `created_at`, `updated_at`
  - Index on `(user_id, created_at)`
  - FK to `core.users` with `ON DELETE SET NULL`
- `finance.finance_payment_purpose_enum` now includes `DONATION`.
- `finance.finance_payment_reference_type_enum` now includes `donation`.
- New table: `finance.download_events`
  - `id` (UUID, PK)
  - `user_id` (UUID, FK)
  - `product_id` (BIGINT, FK)
  - `occurred_at` (TIMESTAMPTZ, default now)
  - `is_free` (BOOLEAN)
  - `ip` (nullable)
  - `user_agent` (nullable)
  - `request_id` (nullable)
  - Indexes on `(user_id, occurred_at)`, `(user_id, is_free, occurred_at)`, `(product_id, occurred_at)`

## API Endpoints

### Donations
- `POST /donations/init`
  - Auth required (JWT)
  - Body: `{ "amount": 50000 }`
  - Response: `{ donationId, paymentId, trackId, redirectUrl, amount }`

- `POST /donations/pay-with-wallet`
  - Auth required (JWT)
  - Body: `{ "amount": 50000, "idempotencyKey": "donation-req-123" }`
  - Response: `{ donationId, paymentId, status, fulfillmentStatus, newBalance }`

- `GET /donations/:id/result`
  - Auth required
  - Response: `{ amount, status, message, referenceId }`

### Purchased-Product Awareness
- Catalog product list and detail responses now include `hasPurchased` (boolean) for the current user.
  - Examples: `GET /catalog/products`, `GET /catalog/products/:id`

### Free Downloads
- Canonical endpoint: `GET /api/products/:id/download` (global prefix defaults to `api`, configurable via `GLOBAL_PREFIX`).
- Backward-compatible endpoint: `POST /api/products/:id/download`
  - Auth required
  - Enforces daily limits for free products only.
  - Default daily limit = 10 for non-subscribers.
  - Active subscription overrides the free limit using `plan.dailyFreeLimit`.
  - Exceeded limit returns `403` with: `سقف دانلود روزانه محصولات رایگان به پایان رسیده است.`
  - Returns `signedUrl` (always present when download is allowed) and `storageKey`.
  - Paid products require entitlement; otherwise returns `403`:
    - `برای دانلود نیاز به خرید محصول است.`
  - Subscription-only products require an active subscription; otherwise returns `403`:
    - `برای دانلود نیاز به اشتراک فعال است.`
  - Missing product file returns `404`:
    - `فایل محصول یافت نشد.`
  - Success response example:
    ```json
    {
      "allowed": true,
      "source": "FREE_QUOTA",
      "reason": "FREE_QUOTA",
      "productType": "FREE",
      "signedUrl": "https://cdn.example.com/files/abc.zip",
      "storageKey": "products/1024/file.zip"
    }
    ```

### Admin Downloads
- `GET /admin/users/:id/downloads`
  - Auth required (admin.users:read)
  - Query: `from`, `to` (YYYY-MM-DD), `freeOnly`, `page`, `limit`
  - Returns download events with `occurredAt`, `isFree`, product info, and `ip/userAgent`.

## Usage Examples

### Donation Flow
1) Create donation payment:
   - `POST /donations/init` with amount
   - or `POST /donations/pay-with-wallet` for wallet-based donations
2) Complete payment on the gateway
3) Verify payment (optional manual verification):
   - `POST /payments/:id/verify`
4) Fetch donation result for the thank-you page:
   - `GET /donations/:id/result`

### Purchased-Product Awareness
- Call any catalog product list endpoint as an authenticated user.
- Each item includes `hasPurchased` for that user.

### Free Downloads
- Call `GET /products/:id/download` for a free product.
- If within quota, the response returns a download decision with `signedUrl`.

## Test Scenarios

### Donations
- Success path: init donation, verify payment, result shows `SUCCESS` and reference id.
- Failure path: gateway verification fails, result shows `FAILED`.
- Authorization: user cannot access another user's donation result.

### Purchased Products
- User with entitlement sees `hasPurchased: true` on list and detail.
- User without entitlement sees `hasPurchased: false`.

### Free Downloads
- Non-subscriber downloads up to 10 free files in a day; the 11th returns a quota error.
- Subscriber uses plan-based limits for free/subscription downloads.
- Download logs and daily usage counters update per request.
- Download events capture `ip`, `userAgent`, and `requestId` when available.

## Configuration
- No new environment variables were added for this feature.
- Daily quota window uses `Asia/Tehran` via `getTehranDateKey`.

## Migrations & Tests
- Run migrations:
  - `npx prisma migrate deploy`
  - (dev) `npx prisma migrate dev`
- Run tests:
  - `npx jest apps/api/src/finance/downloads/downloads.service.spec.ts`
  - `npx jest apps/api/src/core/users/admin/admin-users.service.spec.ts`
