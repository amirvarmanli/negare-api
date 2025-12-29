# Wallet System (Finance)

This document describes the wallet design, ledger model, top-up flow, and wallet-based order payments in the finance module.

## Design Overview

- **Ledger-first**: The source of truth is `finance.wallet_transactions`. Each credit/debit is immutable and recorded with a reason and status.
- **Cached balance**: `finance.wallets.balance` is a cached value updated atomically alongside ledger writes for performance.
- **Single currency**: All wallet amounts are stored in **TOMAN** (integer).
- **Idempotent operations**: Ledger entries are keyed by idempotency keys to avoid duplicate credits/debits.

## Wallet Currency & Payment Purpose Rules

- The platform is **TOMAN-only**. Wallet balances and wallet transactions are stored and returned in TOMAN.
- Gateway integrations may use IRR; conversion happens **only at the gateway boundary**:
  - TOMAN → IRR when requesting payment
  - IRR → TOMAN when validating gateway amounts
- Payments carry a **purpose**:
  - `ORDER` for product/subscription purchases
  - `WALLET_TOPUP` for wallet charges

## Data Model

### FinanceWallet
- `id` (UUID)
- `userId` (unique)
- `balance` (integer, TOMAN)
- `currency` ("TOMAN")
- `status` (`ACTIVE` | `SUSPENDED`)
- timestamps

### FinanceWalletTransaction
- `id` (UUID)
- `walletId` / `userId`
- `type` (`CREDIT` | `DEBIT`)
- `reason` (`TOPUP` | `ORDER_PAYMENT` | `REFUND` | `ADJUSTMENT` | `WITHDRAWAL`)
- `status` (`PENDING` | `SUCCESS` | `FAILED` | `CANCELED`)
- `amount` (positive integer, TOMAN)
- `balanceAfter` (nullable)
- `referenceId` (paymentId or orderId)
- `idempotencyKey` (unique per wallet when present)
- timestamps

### FinancePayment
- Used for gateway-based top-ups and order payments.
- Wallet top-ups are tagged with `referenceType = WALLET_CHARGE`.

## Wallet Top-up Flow

1. **Request**: `POST /wallet/topup` with `{ amount }`.
2. **Create payment + pending ledger**:
   - `finance.payments` row is created with status `PENDING`.
   - A `wallet_transactions` entry is created with:
     - `type = CREDIT`, `reason = TOPUP`, `status = PENDING`
     - `referenceId = payment.id`
     - `idempotencyKey = payment:{payment.id}`
3. **Gateway redirect**: API returns `paymentId` + redirect URL.
4. **Verification callback**:
   - If success:
     - Payment → `SUCCESS`
     - Wallet transaction → `SUCCESS`
     - Wallet balance is incremented atomically
   - If failed:
     - Payment → `FAILED`
     - Wallet transaction → `FAILED`

## Pay Order with Wallet

1. **Request**: `POST /orders/:id/pay-with-wallet`.
2. **Atomic transaction**:
   - Ensure order is payable and wallet is `ACTIVE`.
   - Create a `wallet_transactions` entry with:
     - `type = DEBIT`, `reason = ORDER_PAYMENT`, `status = PENDING`
     - `referenceId = order.id`
     - `idempotencyKey = order:{order.id}`
   - Decrement `wallets.balance` with a conditional update (`balance >= amount`).
   - Mark wallet transaction `SUCCESS` and record `balanceAfter`.
   - Mark order `PAID` and grant entitlements.

## Idempotency Strategy

- **Top-ups**: `idempotencyKey = payment:{payment.id}` ensures repeated callbacks do not double-credit.
- **Order payments**: `idempotencyKey = order:{order.id}` ensures a single debit per order.
- Database uniqueness is enforced by `(wallet_id, idempotency_key)`.

## Concurrency & Consistency

- All wallet operations run inside **Prisma transactions**.
- Wallet debits use **conditional updates** to prevent race conditions:
  - `UPDATE wallets SET balance = balance - amount WHERE balance >= amount`
- Ledger updates and balance updates occur in the same transaction, keeping them consistent.

## API Endpoints

### Wallet (protected)
- `GET /wallet` — current balance + status
- `GET /wallet/transactions?page=1&limit=20`
- `POST /wallet/topup` — start a top-up

### Payments
- `POST /payments/:id/verify` — verify a gateway payment by id (JWT)
- `GET /payments/callback?trackId=...` — gateway callback (public)
- `GET /payments/:id/result` — unified payment result for UI

### Orders
- `POST /orders/:id/pay-with-wallet`

## Example Requests (curl)

```bash
# Wallet balance
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  $API_BASE/wallet

# Wallet topup
curl -X POST -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 200000}' \
  $API_BASE/wallet/topup

# Verify payment by id
curl -X POST -H "Authorization: Bearer $ACCESS_TOKEN" \
  $API_BASE/payments/$PAYMENT_ID/verify

# Pay order with wallet
curl -X POST -H "Authorization: Bearer $ACCESS_TOKEN" \
  $API_BASE/orders/$ORDER_ID/pay-with-wallet
```

## Verification Checklist

- Topup success: wallet balance increases by amountToman exactly once.
- Order success: order status changes to `PAID` and wallet balance is unchanged.
- Currency: wallet APIs always return `TOMAN`.
- Idempotency: re-calling verification does not duplicate effects.
- Payment result endpoint returns correct `purpose` and fields.

## Postman

Collection file: `postman/Negare-Finance.postman_collection.json`
- Variables: `API_BASE`, `ACCESS_TOKEN`, `ORDER_ID`, `PAYMENT_ID`
- Includes tests for wallet top-up and wallet order payment.
