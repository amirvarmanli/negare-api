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
   - The order is marked `PAID`.
   - Entitlements are granted.
   - Cart items were cleared during checkout.
7. Frontend is redirected to `/payment/result?status=success|failed&orderId=...&trackId=...`.
8. Frontend calls `GET /orders/:id/purchase-result` (JWT) to fetch purchased items and secure download links.

### Wallet flow
1. `POST /orders/:id/pay/wallet`.
2. If balance is sufficient, the order is marked `PAID`, entitlements are granted, and the wallet is debited atomically.

## Subscription Purchase

1. `POST /subscriptions/purchase` with `{ planId }` to create a pending purchase.
2. `POST /payments/start` with `{ refType: "subscription", refId: purchaseId }`.
3. On successful callback:
   - Purchase status becomes `PAID`.
   - Subscription is activated/extended.

Wallet flow:
- `POST /wallet/pay` with `{ refType: "subscription", refId: purchaseId }`.

## Wallet Charge (Top-up)

1. `POST /wallet/charge` with `{ amount }`.
2. Redirect to the gateway URL.
3. On successful callback, a `TOPUP` wallet transaction is recorded.

## Payment Callback & Idempotency

- `GET /payments/callback` and `GET /payments/zibal/callback` are public.
- Callback logic is idempotent:
  - Payment status transitions only from `PENDING` → `SUCCESS`/`FAILED`.
  - Wallet top-ups use `createTransactionIfMissing` to avoid duplicate credits.
  - Order payments store an order id on the payment record to prevent double fulfillment.
- `POST /payments/verify` (JWT) returns the payment status and reference details.

## Payments Persistence & History

Every payment attempt is stored in `finance.payments` and **never deleted** (financial audit safety). Records include:
- `userId`, `orderId` (optional), `referenceType`/`referenceId` (wallet/subscription/cart reference)
- `provider` (gateway), `status` (`PENDING`, `SUCCESS`, `FAILED`, `CANCELED`)
- `amount`, `currency`, `paidAt`, `failureReason` (nullable)
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

## Notes

- All money amounts are in TOMAN.
- All cart, wallet, payments, and subscription endpoints require JWT (callbacks are public).
- Run Prisma migration + generate after schema changes:
  - `npx prisma migrate dev`
  - `npx prisma generate`
