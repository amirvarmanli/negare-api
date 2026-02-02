# Negare Payments & Wallet Flows

This document describes the standardized Cart, Wallet, Payments (Gateway), and Subscription purchase flows.

## Product Purchase (Cart)

### Gateway flow
1. `GET /cart` to fetch the active cart (items + `totalAmount`).
2. `POST /cart/checkout` to create a pending order (`orderId`).
3. `POST /orders/:id/pay/gateway/init` to create a Zibal payment and get `gatewayUrl`.
4. Redirect the user to `gatewayUrl`.
5. Gateway calls `GET /payments/callback?trackId=...` (or legacy `/payments/zibal/callback`).
6. On success:
   - Payment status becomes `SUCCESS`.
   - `fulfillmentStatus` transitions to `SUCCESS` after downstream steps complete.
   - The order is marked `PAID`.
   - Entitlements are granted.
   - Cart items were cleared during checkout.
7. Frontend is redirected to `/payment/result?status=success|failed&orderId=...&trackId=...`.
8. Frontend calls `GET /orders/:id/purchase-result` (JWT) to fetch purchased items and secure download links.

### Wallet flow
1. `POST /orders/:id/pay/wallet` (or `/orders/:id/pay-with-wallet`).
2. If balance is sufficient:
   - Wallet is debited (ledger + balance) atomically.
   - A `finance.payments` row is created with `status=SUCCESS` and `provider=MOCK` (`meta.method = WALLET`).
   - `fulfillmentStatus` transitions to `SUCCESS` after downstream steps complete.
   - The order is marked `PAID`.
   - Entitlements are granted and revenue/discount hooks are applied.
   - The cart is cleared in the same transaction.
3. The endpoint returns `PaymentResponseDto` (use `paymentId` to call `GET /payments/:id/result`).

## Subscription Purchase

1. `POST /subscriptions/purchase` with `{ planId }` (the `planId` must come from `GET /subscriptions/plans`) to create a pending purchase.  
   - 404 if the plan is missing.  
   - 409 if the plan exists but is inactive.
   - Requires DB column `finance.subscription_purchases.subscription_plan_id` (migration
     `20260202000000_subscription_purchase_plan_fk_hotfix`).
2. `POST /payments/start` with `{ refType: "subscription", refId: purchaseId }`.
3. On successful callback:
   - Purchase status becomes `PENDING` → `PAID`.
   - Subscription is activated/extended using the plan’s `durationDays`.

Response payload includes the purchased plan metadata so the frontend can reconcile it with the list endpoint:

```json
{
  "purchaseId": "purchase-uuid",
  "amount": 150000,
  "currency": "TOMAN",
  "durationDays": 30,
  "planTitle": "Starter",
  "status": "PENDING",
  "plan": {
    "id": "plan-uuid",
    "title": "Starter",
    "price": 150000,
    "durationDays": 30,
    "dailySubscriptionDownloadLimit": 5,
    "dailyFreeDownloadLimitWithSubscription": 10,
    "isActive": true,
    "description": "Starter plan"
  },
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

Wallet flow:
- `POST /wallet/pay` with `{ refType: "subscription", refId: purchaseId }`.

## Wallet Charge (Top-up)

1. `POST /wallet/charge` with `{ amount }`.
2. Redirect to the gateway URL.
3. On successful callback, a `TOPUP` wallet transaction is recorded.

## Donation (Wallet)

- `POST /donations/pay-with-wallet` with `{ amount, idempotencyKey }`.
- Debits the user wallet, creates a `finance.payments` row (`provider=MOCK`), and marks the donation `SUCCESS`.

## Payment Callback & Idempotency

- `GET /payments/callback` and `GET /payments/zibal/callback` are public.
- Callback logic is idempotent:
  - Payment status transitions only from `PENDING` → `SUCCESS`/`FAILED`.
  - Wallet top-ups use `createTransactionIfMissing` to avoid duplicate credits.
  - Order payments store an order id on the payment record to prevent double fulfillment.
  - Fulfillment retries reuse `fulfillmentStatus` to avoid duplicate side effects.
- `POST /payments/verify` (JWT) returns the payment status and reference details.
- `POST /admin/payments/:id/fulfill` (admin) retries fulfillment when a payment is `SUCCESS` but not fulfilled.

## Payments Persistence & History

Every payment attempt is stored in `finance.payments` and **never deleted** (financial audit safety). Records include:
- `userId`, `orderId` (optional), `referenceType`/`referenceId` (wallet/subscription/cart reference)
- `provider` (gateway), `status` (`PENDING`, `SUCCESS`, `FAILED`, `CANCELED`)
- `amount`, `currency`, `paidAt`, `failureReason` (nullable)
- `fulfillmentStatus` (`PENDING`, `SUCCESS`, `FAILED`) + `fulfilledAt` + `fulfillmentError` (nullable)
- Gateway identifiers: `trackId`, `authority`, `refId`

Status lifecycle:
- `PENDING` is created on payment initialization.
- Gateway verification updates the same row to `SUCCESS` or `FAILED`.
- `paidAt` is set when payment succeeds.

Frontend usage for “Payments History”:
1. Call `GET /payments` with optional `status` filter and pagination.
2. Render `status`, `amount`, `currency`, `createdAt`, and `paidAt`.
3. Link to `GET /payments/:id` for full details (includes `failureReason` if needed).

Optional order view:
- `GET /orders/:id/payments` to list payments for a specific order.

## Required Environment Variables

- `DATABASE_URL`
- `ZIBAL_MERCHANT`
- `ZIBAL_BASE_URL`
- `ZIBAL_CALLBACK_URL` (must match `/payments/callback` or `/payments/zibal/callback` with global prefix)
- `FRONTEND_BASE_URL` (redirect target for payment result)
- `API_PUBLIC_BASE_URL` (absolute base for secure download URLs, e.g. `http://localhost:4000/api`)
- `GLOBAL_PREFIX` (if using a global API prefix)

## Postman Testing Guide

Import `postman/negare.postman_collection.json` and set:
- `baseUrl`
- `accessToken`
- `productId`
- `subscriptionPlanId`

Suggested flow:
1. Auth → Login (sets `accessToken`).
2. Cart → Add Cart Item → Get Cart (captures `cartId`).
3. Cart → Checkout Cart (captures `orderId`).
4. Payments → Init Order Gateway Payment → follow `gatewayUrl` in browser.
5. Payments → Payment Callback (Verify) to force verification.
6. Payments → Verify Payment Status to inspect final status.

For subscriptions:
1. Subscriptions → Purchase Subscription (captures `subscriptionPurchaseId`).
2. Payments → Start Payment (Subscription).

For wallet:
1. Wallet → Charge Wallet.
2. Wallet → Get Wallet.

### Testing subscription purchases

1. GET `/subscriptions/plans` (JWT) and copy one of the `id` values from the response.
2. POST `/subscriptions/purchase` using that `planId` and confirm the response contains `plan`, `amount`, `currency`, `status`, and `createdAt` before calling `/payments/start`.
3. Run `npx jest --config jest.config.ts apps/api/src/finance/subscriptions/subscriptions.service.spec.ts apps/api/src/finance/subscriptions/dto/subscription-purchase.dto.spec.ts` to verify the validation logic.

## Notes

- All money amounts are in TOMAN.
- All cart, wallet, payments, and subscription endpoints require JWT (callbacks are public).
- Run Prisma migration + generate after schema changes:
  - `npx prisma migrate dev`
  - `npx prisma generate`
