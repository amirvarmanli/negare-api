# Finance Wallet Notifications

Platform wallet activity now always triggers an internal notification for the owner defined by `PLATFORM_WALLET_USER_ID`.

## When a notification fires

- **Trigger point**: `FinanceWalletTransaction` creation in `WalletService.createTransaction`.
- **Recipient**: the `PLATFORM_WALLET_USER_ID` user (loaded via `ConfigService` and validated with every transaction).
- **Notification type**: `NotificationType.WALLET_TRANSACTION_RECORDED` (existing `PLATFORM_DISCOUNT_APPLIED` alerts remain for coupons).
- **Payload**: Persian title (`افزایش موجودی کیف پول` for credits, `کاهش موجودی کیف پول` for debits) plus a structured body/data that includes amount, direction, reason, idempotency key, related order/payment/product/coupon when available, timestamp, traceId, and relative admin links.
- **Dedup**: `UserNotification` rows use `dedupeKey = wallet_tx:{walletTransaction.id}` so reposted ledger entries never produce duplicate inbox rows. The queue job logs the dedupe hit with `traceId`, `walletTxId`, `walletUserId`, `reason`, and `amount`.
- **Logs**: creation, notification attempts, and queue dedup events all log the same identifiers for easy tracing.

## Postman verification

1. Open `postman/Negare-Finance.postman_collection.json`.
2. Authenticate as the platform wallet owner and update `{{ACCESS_TOKEN}}`.
3. Run **Wallet ➜ Wallet Topup** to generate a wallet transaction.
4. Run **Wallet ➜ Verify Platform Notifications**; the built-in test asserts that an item of type `WALLET_TRANSACTION_RECORDED` is present in your inbox.

The notification's `data` field contains `type`, `amount`, `direction`, `reason`, `links`, `traceId`, `timestamp`, etc., so the admin UI can present both text and clickable shortcuts without coupled logic in every finance flow.
