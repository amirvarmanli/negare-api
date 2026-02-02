# One-Time Purchase Flow

## Flow Steps
1. **Checkout confirm** (`POST /checkout/confirm`) builds or resumes the order using `requestId`, caches the session, and returns payment initialization data so the UI redirects to the gateway.
2. **Gateway callback / verify** (`GET /payments/zibal/callback`, `GET /payments/callback`, `POST /payments/gateway/verify`) verifies the payment and, on success, marks the order `PAID`, grants entitlements, applies revenue/discount hooks, and clears the buyer’s cart inside the same Prisma transaction.
   - `fulfillmentStatus` is recorded on the payment to capture downstream completion.
3. **Download entitlement** (`POST /subscriptions/downloads/validate`) reads the same `finance_entitlement` rows created above, allowing subscription or purchased products to pass and returning signed/storage URLs when applicable.
4. **Cart inspection** (`GET /cart`) confirms the cart is empty after fulfillment; this endpoint must read zero items because the backend wipes the cart during the callback.

## Source of Truth
- **Order records** live in `finance_order`/`finance_order_item`.
- **Purchase entitlements** are persisted in `finance_entitlement` with the unique index `entitlements_user_id_product_id_key`, so re-processing the same order simply updates the existing row.
- **Downloads** rely on the entitlement lookup (`EntitlementsService.hasPurchased`) used by both `DownloadsService` and the subscription download validator.
- **Cart clearing** is done through `CartService.clearCartInTransaction` inside the payment transaction to keep the cart status consistent with fulfillment.

## Idempotency Strategy
- The checkout confirm flow caches responses keyed by `requestId` to safely retry or refresh payment intents without duplicating orders.
- Gateway callbacks only update payments/orders when their status is still `PENDING` (`updateMany` guarded by status), so retries are no-ops.
- Admin retry endpoint: `POST /admin/payments/:id/fulfill` (JWT + `admin.finance:manage`) for `SUCCESS` payments with failed fulfillment.
- `EntitlementsService.grantPurchaseEntitlements` uses `upsert` keyed by `(userId, productId)`, ensuring duplicate callbacks do not insert multiple entitlement rows.
- Cart clearing is guarded by checking for an existing cart, and `clearCartInTransaction` can safely run multiple times.
- Platform wallet coupon debits use `idempotencyKey = order:<orderId>:platform-discount`, so retries skip the ledger entry and notification.
- Failures (amount mismatch, verification failure, expired order) mark the order `FAILED` and leave the cart untouched.

## Platform-funded coupon discount settlement
1. Checkout confirm persists the coupon metadata (`discountAmount`, `discountSource`, `couponCode`, `discountReason`) on the `finance_order` record so fulfillment does not have to recompute discounts or rely on transient session data.
2. Fulfillment recomputes `grossAmount` as the sum of `finance_order_item.line_total`. Suppliers still receive `supplierShareGross = floor(grossAmount * supplierPercent / 100)` based on that gross amount, so coupons never shrink the supplier payout.
3. The platform wallet is debited by `discountAmount` whenever `discountSource` indicates a platform-funded coupon/campaign. The wallet transaction uses `WalletTransactionReason.PLATFORM_DISCOUNT`, stores `orderId`, `paymentId`, `couponCode`, and `userId`, and reuses `idempotencyKey = order:<orderId>:platform-discount` to avoid duplicate debits or notifications.
4. The whole flow (marking the order `PAID`, granting entitlements, assigning revenue splits, debiting the platform wallet, and clearing the cart) runs inside a single Prisma transaction with structured logs that capture `traceId`, `userId`, `orderId`, `paymentId`, `grossAmount`, `discountAmount`, and `payableAmount`.
5. An internal `NotificationType.PLATFORM_DISCOUNT_APPLIED` broadcast is emitted in Persian using the template below; it contains both human-readable text and a structured payload that includes `links.order`, `links.user`, and `links.products` so the admin UI can render clickable shortcuts:

    ```
    مبلغ {discountAmount} تومان بابت اعمال کد تخفیف «{couponCode}» از کیف پول سایت کسر شد.

    🔹 سفارش: #{orderId}
    🔹 کاربر: {userId} ({phoneOrEmail})

    💰 مبلغ قبل از تخفیف: {grossAmount} تومان
    💳 مبلغ پرداختی کاربر: {payableAmount} تومان

    این تخفیف توسط پلتفرم تأمین شده و سهم تأمین‌کننده بدون تغییر تسویه شده است.
    ```

   The notification payload also stores `type`, `traceId`, `timestamp`, and the `links` object where `links.order = /admin/orders/{orderId}`, `links.user = /admin/users/{userId}`, and `links.products` contains `{ productId, title, url }` for each purchased SKU.

**Negative balance guardrail:** Set `PLATFORM_WALLET_ALLOW_NEGATIVE=true` only if your platform wallet may dip below zero. When the flag is `false` (the default), insufficient funds abort the transaction, mark the order `FAILED`, and surface a handled error so the customer does not see a success page while the discount remains unsettled.

**Example:** A 1,200 Toman gross order with a 100 Toman coupon records `total = 1,100`. The supplier still earns 840 Toman (70% of 1,200), the platform wallet pays the 100 Toman discount (`WalletTransactionReason.PLATFORM_DISCOUNT`), and the buyer pays 1,100 Toman.

## Tests
1. `npx jest apps/api/src/finance/payments/payments.service.fulfillment.spec.ts` – verifies success (entitlements + cart clear), platform-funded coupon settlement (platform wallet debit + notification), idempotency on duplicate callbacks, and that failed callbacks avoid extra work.
2. `npx jest apps/api/src/finance/subscription-system/subscription-downloads.service.spec.ts` – ensures purchased products succeed in the subscription download validator.

## Postman
1. Import `postman/Purchase-Flow.postman_collection.json`.
2. Set the required variables: `baseUrl`, `accessToken`, `orderId`, `productId`, `paymentId`, `couponCode`, and `platformAccessToken` (set this to a platform/admin token that owns the platform wallet, or reuse `accessToken` if the logged-in user is the platform wallet owner).
3. Step through the collection:
   - **Checkout Quote (with coupon)** to preview the discounted totals and ensure the coupon code is accepted.
   - **Checkout Confirm (with coupon)** to create the order, persist discount metadata, and get `orderId` for the payment.
   - **Payment Verify (mock)** to simulate the gateway callback and trigger the platform-funded coupon settlement.
   - **Validate Download** to make sure the entitlement created during fulfillment authorizes the download.
   - **Get Cart (confirm empty)** to verify the cart was cleared.
   - **Platform Wallet Transactions** to inspect the ledger for a `PLATFORM_DISCOUNT` entry tied to the `orderId`/`paymentId`; expect the amount to equal the coupon value.
4. Confirm each response shows success, that the download validation returns `allowed: true`, the cart payload contains zero items, and the wallet ledger lists the platform-funded discount debit.

Keeping this document updated ensures the front-end and QA teams follow the same purchasing contract, and the tests above guard the new fulfillment guarantees.
