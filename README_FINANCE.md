# Negare Finance System

## Modules
- Finance (Prisma integration)
- Products (read-only catalog product access + contributors)
- Cart (server-side)
- Orders
- Payments (gateway + wallet)
- Wallet (ledger)
- Entitlements (purchases)
- Downloads (quota gate)
- Subscriptions (plans + user subscription)
- Revenue (order splits + subscription pools)

## Prisma Models
- product_contributors
- carts
- cart_items
- orders
- order_items
- payments
- product_discounts
- user_discounts
- coupons
- coupon_redemptions
- wallet_transactions
- entitlements
- download_usage_daily
- download_logs
- subscription_plans
- user_subscriptions
- subscription_revenue_pools
- subscription_supplier_earnings
- order_revenue_splits
- supplier_payouts

## Flows
### Paid purchase (gateway)
1. `POST /orders` creates a PENDING_PAYMENT order with item snapshots.
2. `POST /orders/:id/pay/gateway/init` creates a Zibal payment and returns `trackId` + `gatewayUrl`.
3. Client redirects to `gatewayUrl` (`https://gateway.zibal.ir/start/{trackId}`).
4. Zibal calls public `GET /payments/zibal/callback?trackId=...` (no auth); backend verifies with Zibal.
5. Callback responds with a 302 redirect to `${FRONTEND_BASE_URL}/payment/result?status=success|failed&orderId=...&trackId=...`.
   - If `Accept: application/json` is sent, it returns JSON instead of redirect.
6. On success, order is marked PAID, entitlements are granted, and revenue splits (70/30) are recorded.
7. Payment result UI fetches purchase-result via `GET /orders/:id/purchase-result` (auth required).
8. Client can also call `GET /me/purchases` to list owned items with download URLs.

### Paid purchase (wallet)
1. Ensure wallet has enough balance (topup if needed).
2. `POST /orders/:id/pay/wallet` deducts wallet funds, marks order PAID, and grants entitlements.

### Wallet topup (gateway)
1. `POST /wallet/topup/gateway/init` creates a Zibal payment and returns `trackId` + `gatewayUrl`.
2. Client redirects to Zibal.
3. Zibal calls public `GET /payments/zibal/callback?trackId=...`; backend verifies and applies topup, then redirects to frontend.

## Cart
### Data model
- `FinanceCart` (one cart per user, status ACTIVE/CHECKED_OUT/ABANDONED).
- `FinanceCartItem` (unique per cart + product, quantity stored; max quantity = 1).

### Endpoints (auth required)
- `GET /cart` returns cart items with current product pricing and totals.
- `POST /cart/items` adds an item (PAID or PAID_OR_SUBSCRIPTION only).
- `PATCH /cart/items/:itemId` updates quantity (0 removes the item).
- `DELETE /cart/items/:itemId` removes an item.
- `DELETE /cart/clear` clears the cart.
- `POST /cart/checkout` creates a PENDING_PAYMENT order and clears the cart.

### Flow: add items → checkout → pay → download
1. Add items to cart with `POST /cart/items`.
2. Review totals with `GET /cart` (discounts auto-resolved from user/product rules).
3. Checkout with `POST /cart/checkout` (optional `couponCode`).
4. Pay via `POST /orders/:id/pay/gateway/init` or `POST /orders/:id/pay/wallet`.
5. Download purchased products via `GET /orders/:id/purchase-result` or `/me/purchases`.

## Purchases (Dashboard)
- `GET /me/purchases` lists paid purchases (sorted by `purchasedAt` desc).
- `GET /me/purchases/:productId` returns a single purchase item.
- Each item includes download URLs with time-limited tokens:
  `GET /downloads/files/:fileId?token=...`
- Invariant: one purchase per product per user (duplicate checkout attempts return 409).
- Entitlement creation is idempotent; repeated callbacks do not create duplicates.

## Order payment TTL
- Orders expire after 15 minutes if unpaid (`expiresAt`).
- Paying an expired order returns 410 (Gone) or a clear validation error.
- Duplicate purchase attempts return 409 (Conflict).

## Public API base for download URLs
- Set `API_PUBLIC_BASE_URL` (e.g. `http://localhost:4000/api`) so purchase-result and purchases return absolute download URLs.

## Manual test checklist
1. Complete checkout → pay order → verify status is `PAID`.
2. Call `GET /orders/:id/purchase-result` and confirm `downloads[].url` starts with `http://localhost:4000/api/downloads/files/`.
3. Call `GET /me/purchases` and confirm items include `downloads[]` and `purchasedAt`.
4. Open a `downloads[].url` in the browser and confirm file streams (token valid).
5. Wait for token expiry and confirm download returns 401.

### Example Postman test steps
1. Set `productId` and `accessToken` in the Finance collection.
2. Call `Cart / Add Cart Item`, then `Cart / Get Cart`.
3. Call `Cart / Checkout Cart` and copy `orderId` into collection variables.
4. Call `Orders / Pay Order via Gateway Init` or wallet pay.

## Discount resolution rules
- Only one discount applies per order.
- Priority: coupon → user-level → product-level → none.
- Discounts apply only to paid products (FREE items are excluded).
- Subscription purchases do not accept product-level discounts.
- Fixed product discounts apply per unit (quantity-aware).
- Legacy `discount` field in `POST /orders` is treated as an inline coupon (`FIXED_`/`PERCENT_`).
- Coupon limits are enforced (expiration, max usage, per-user usage) with redemption tracking.
- Admin endpoints to manage discounts/coupons:
  - `POST /admin/discounts/products`, `GET /admin/discounts/products`
  - `POST /admin/discounts/users`, `GET /admin/discounts/users`
  - `POST /admin/discounts/coupons`, `GET /admin/discounts/coupons`

## Supplier reporting (read-only)
- `GET /supplier/revenue/summary`
- `GET /supplier/revenue/orders`
- `GET /supplier/revenue/subscriptions`
- `GET /supplier/downloads`
- Supplier sees own data; admin can pass `supplierId` to view any supplier or omit for all.
- All endpoints support pagination via `page` and `limit`.

## Payouts / settlements (admin)
- `POST /admin/payouts/compute` aggregates unpaid supplier earnings (orders + finalized subscription pools).
- `POST /admin/payouts/:id/mark-paid` marks payout paid and locks earnings.
- `POST /admin/payouts/:id/mark-failed` marks payout failed (earnings remain locked).
- Once a payout is created, earnings are linked and cannot be recomputed or duplicated.

## Subscription revenue lifecycle
- `POST /admin/revenue/subscription-pools/compute` creates/updates a pool in `OPEN`.
- `POST /admin/revenue/subscription-pools/:id/finalize` locks the pool in `FINALIZED`.
- Finalized pools cannot be recomputed; only finalized pools are eligible for payouts.

## Order expiration
- Orders can be marked `EXPIRED` when unpaid.
- Use `OrdersService.expirePendingOrders(olderThanMinutes)` in a background job.
- Expired orders cannot be paid via gateway or wallet.

## Download delivery contract
- Download gate returns `signedUrl` (if available) or `storageKey` placeholder.
- Download logs are written only after entitlement/quota validation.
- Duplicate download attempts are logged safely without affecting quotas.
- Download tokens expire after `DOWNLOAD_TOKEN_TTL_SECONDS` (default: 10 minutes).

### FREE downloads quota
- Without subscription: 10/day for FREE products.
- With subscription: 15/20/25/day depending on plan.
- Quotas reset at Asia/Tehran midnight.

### Subscription purchase
1. `POST /subscription/purchase` creates a subscription order (PENDING_PAYMENT).
2. Pay via gateway using the same order payment endpoints.
3. On verification, subscription is created or extended.

### Subscription downloads
- `POST /products/:id/download` allows PAID_OR_SUBSCRIPTION only with active subscription.
- Daily sub quota: 2/5/8 for Plan A/B/C.

## Local setup
- Set `DATABASE_URL` to your Postgres instance.
- Ensure `pgcrypto` extension is enabled (`CREATE EXTENSION IF NOT EXISTS pgcrypto;`).
- Set Zibal env vars:
  - `ZIBAL_MERCHANT` (use `"zibal"` for dev testing)
  - `ZIBAL_BASE_URL` (default: `https://gateway.zibal.ir`)
  - `ZIBAL_CALLBACK_URL` (public URL to `GET /payments/zibal/callback` with global prefix if enabled)
  - `ZIBAL_MERCHANT="zibal"` uses Zibal's test merchant flow in development.
- Set `FRONTEND_BASE_URL` to control callback redirects (default: `http://localhost:3000`).
- Optional: set `API_BASE_URL` (or `API_PUBLIC_BASE_URL`) to the backend base URL used in download links.
- Run Prisma migrations:
  - Dev (fresh DB): `npx prisma migrate dev --schema prisma/schema.prisma`
  - Prod (existing data): map models with `@@map`/`@@schema` as shipped and use `npx prisma migrate deploy`
- Migration recovery (prod-like DBs):
  - `npx prisma migrate resolve --rolled-back 20251227173152_add_purchased`
  - `npx prisma migrate deploy`
  - `npx prisma generate`
- Verify purchased_at exists:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='finance' AND table_name='entitlements' AND column_name='purchased_at';
  ```
- Seed subscription plans:
  - `ts-node -r tsconfig-paths/register scripts/seed-subscription-plans.ts`

## Testing with Postman
- Import `postman/Negare-Finance.postman_collection.json`.
- Set `baseUrl`, `accessToken`, and `trackId` variables.
- Flow to test Zibal:
  1. Create order.
  2. Call `Pay Order via Gateway Init` and copy `trackId` into collection variable.
  3. Open the `gatewayUrl` from the response in a browser.
 4. After Zibal redirect, call `Zibal Callback Verify` using the same `trackId`.
- Purchases flow:
  1. Call `Me Purchases / Get Purchases` (sets `purchaseProductId`, `fileId`, `downloadToken`).
  2. Call `Me Purchases / Get Purchase By Product`.
  3. Call `Downloads / Download Purchased File`.
 - Discounts flow:
   1. Create a coupon via `Admin / Discounts`.
   2. Create order with `couponCode` (or legacy `discount`).
 - Supplier reports:
   1. Use supplier token and call `Supplier Reports` endpoints.
 - Payouts:
   1. Compute subscription pool, then finalize it.
   2. Compute payouts and mark one paid.

## Timezone daily reset
- Quotas use Asia/Tehran date keys (`YYYY-MM-DD`).
- All quota consumption is locked per user/date row in a transaction.

## Subscription revenue pools
- Admin endpoint: `POST /admin/revenue/subscription-pools/compute?year=YYYY&month=MM`
- Uses paid subscription orders in the period and SUB_QUOTA download logs.

## Notes
- Monetary amounts are stored as integers (smallest unit).
- Mock verification endpoints remain for legacy/manual testing only.
- Coupon parsing supports `FIXED_<amount>` and `PERCENT_<value>` patterns.
- Subscription pricing is defined in `apps/api/src/finance/common/finance.constants.ts`.
- Migration safety: if the old finance tables exist from TypeORM, keep them and let Prisma map via the `finance` schema models; for a clean dev reset, drop the `finance` schema and re-run Prisma migrations.

## End-to-end checklist
- Create paid order → init Zibal payment → complete callback → entitlements granted.
- Apply coupon/user/product discount and verify order totals.
- Verify supplier revenue summary + orders + subscriptions + downloads.
- Compute and finalize subscription pool.
- Compute payouts → mark paid → verify payout locking.
- Expire old PENDING_PAYMENT orders and ensure they cannot be paid.
- Attempt repurchase of an owned product → expect 409 Conflict.
