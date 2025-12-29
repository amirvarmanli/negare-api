# Finance Support Features

This document covers the donation flow, purchased-product awareness, and free download limits added to the backend.

## Architecture Decisions
- Donations are stored as first-class records in the finance schema and are tied to a gateway payment via `referenceId`.
- Donation payments reuse the existing gateway integration and verification flow to avoid duplicating gateway logic.
- Purchased-product awareness is driven by finance entitlements to avoid N+1 lookups and keep results user-specific.
- Free downloads are gated by the finance downloads service with daily quotas (per user, per day) and return a signed URL when available.

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

## API Endpoints

### Donations
- `POST /donations/init`
  - Auth required
  - Body: `{ "amount": 50000 }`
  - Response: `{ donationId, paymentId, trackId, redirectUrl, amount }`

- `GET /donations/:id/result`
  - Auth required
  - Response: `{ amount, status, message, referenceId }`

### Purchased-Product Awareness
- Catalog product list and detail responses now include `hasPurchased` (boolean) for the current user.
  - Examples: `GET /catalog/products`, `GET /catalog/products/:id`

### Free Downloads
- `POST /products/:id/download`
  - Auth required
  - Enforces daily limits based on subscription plan or base free limit.
  - Returns `signedUrl` (when storage supports signed URLs) and `storageKey` for free/subscription downloads.

## Usage Examples

### Donation Flow
1) Create donation payment:
   - `POST /donations/init` with amount
2) Complete payment on the gateway
3) Verify payment (optional manual verification):
   - `POST /payments/:id/verify`
4) Fetch donation result for the thank-you page:
   - `GET /donations/:id/result`

### Purchased-Product Awareness
- Call any catalog product list endpoint as an authenticated user.
- Each item includes `hasPurchased` for that user.

### Free Downloads
- Call `POST /products/:id/download` for a free product.
- If within quota, the response returns a download decision and signed URL.

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
