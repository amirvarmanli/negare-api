# Notifications System

This document describes the in-app notifications system for Negare.

## Data model (Prisma)

Core schema models:

- `Notification`: immutable message template (type/title/body/actionUrl/entityType/entitySlug/entityId/href/data, createdById).
- `UserNotification`: delivery row per user (status/readAt/deletedAt/deliveredAt/dedupeKey).

Indexes:

- `user_notifications (userId, status, createdAt)`
- `user_notifications (userId, createdAt)`
- `unique(userId, dedupeKey)` for idempotency (nullable).

Enums:

- `NotificationType`: `ADMIN_BROADCAST`, `FOLLOWED_YOU`, `PURCHASED_YOUR_PRODUCT`, `WALLET_CREDITED`, `NEW_PRODUCT_FROM_FOLLOWED`
- `NotificationStatus`: `UNREAD`, `READ`, `ARCHIVED`
- `NotificationTargetGroup`: `ALL_USERS`, `SUPPLIERS_ONLY`, `USERS_ONLY`

## RBAC permissions

- `admin.notifications:send`
- `admin.notifications:read`
- `user.notifications:read`
- `user.notifications:manage`

Seed/update permissions:

```
npx ts-node scripts/seed-permissions.ts
```

## Redis + BullMQ setup

Env vars (already supported by config):

- `REDIS_URL=redis://localhost:6379`
- or `REDIS_HOST` + `REDIS_PORT`

BullMQ queue name: `notifications`

## Running the worker (dev)

The worker is part of the Nest app via `NotificationsQueueModule`.

Start Redis:

```
docker run --name negare-redis -p 6379:6379 redis:7
```

Start API:

```
npm run start:dev
```

## Event triggers

Automatic events are wired in existing services:

- Followed you: `ArtistService.follow` -> type `FOLLOWED_YOU`
- Purchased your product: `PaymentsService` after order paid -> `PURCHASED_YOUR_PRODUCT`
- Wallet credited: payment wallet topup success -> `WALLET_CREDITED`
- New product from followed artist: product status transitions to `PUBLISHED` -> `NEW_PRODUCT_FROM_FOLLOWED` (fan-out to followers)

## Event message format (Persian)

Event notifications use structured payloads so the frontend can render clickable segments without parsing text.

Message examples:

- `PURCHASED_YOUR_PRODUCT`: `{buyerFullName} محصول «{productTitle}» شما را خرید.`
- `WALLET_CREDITED`: `مبلغ {amount} تومان به کیف پول شما بابت فروش محصول «{productTitle}» اضافه شد.`
- `NEW_PRODUCT_FROM_FOLLOWED`: `{artistName} محصول «{productTitle}» را منتشر کرد.`
- `FOLLOWED_YOU`: `{actorName} شما را دنبال کرد.`

Admin broadcasts remain exactly as written by admins.
For paid purchases, `WALLET_CREDITED.amount` reflects the supplier share after platform commission. If the platform owns the product, the platform receives a 100% wallet credit notification.

### Notification `data` contract

Each event notification may include the following structured data:

```json
{
  "actor": {
    "id": "user-id",
    "fullName": "نام کامل",
    "username": "handle-or-null",
    "avatarUrl": "https://..."
  },
  "product": {
    "id": "product-id",
    "title": "عنوان محصول",
    "slug": "product-slug"
  },
  "amount": {
    "value": 120000,
    "currency": "IRR"
  },
  "richText": [
    { "kind": "user", "text": "امیرحسین ورمانلی", "userId": "user-id", "username": "amirhosein" },
    { "kind": "text", "text": " محصول «" },
    { "kind": "product", "text": "وکتور پترن برگ و گل", "productId": "product-id", "slug": "leaf-flower-pattern" },
    { "kind": "text", "text": "» شما را خرید." }
  ]
}
```

`richText` segments are ordered and safe to render without string parsing. Only `user` and `product` segments are linkable.

## API endpoints

User inbox (`/notifications`):

- GET `/notifications`
- GET `/notifications/unread-count`
- PATCH `/notifications/:id/read`
- PATCH `/notifications/read-all`
- DELETE `/notifications/:id` (archive)

Admin broadcast (`/admin/notifications`):

- POST `/admin/notifications/broadcast`
- GET `/admin/notifications`
- GET `/admin/notifications/all`
- GET `/admin/notifications/feed`
- DELETE `/admin/notifications/feed/:recipientRowId`
- GET `/admin/notifications/timeline`
- GET `/admin/notifications/broadcasts`
- DELETE `/admin/notifications/broadcasts/:notificationId`

Notes:

- `Notification.id` is the template id (used by admin).
- `UserNotification.id` is the per-user inbox id (used by read/archive endpoints).
- Unread count is computed from `UserNotification` rows with status `UNREAD`.

## Idempotency + batching

- Auto events use `dedupeKey` to avoid duplicate user notifications.
- Queue jobs fan out in chunks of 500 with `createMany` + `skipDuplicates`.

## Manual test checklist

- Admin broadcast creates a Notification and enqueues delivery to target group.
- User inbox list returns only the authenticated user’s notifications.
- Unread count reflects delivered notifications.
- Mark read/read-all updates status + readAt.
- Delete archives (status = ARCHIVED).
- Admin feed list shows per-recipient deliveries and supports soft delete.
- Admin feed excludes broadcast deliveries.
- Admin timeline returns a single, paginated list that merges broadcasts with per-recipient events. Use this endpoint for UI pagination.
- Broadcasts list returns one row per broadcast with sender identity, message, and sent time.
- Deleting a broadcast removes it for all users (global delete).
- Purchase notification includes buyer name + product title and `data.richText` segments for user + product.
- Wallet credit notification includes amount, and `data.amount` is structured.
- Wallet credit amount reflects the supplier share for paid orders (not the full order total).
- For platform-owned products, wallet credit amount is the full line total and recipient is the platform user.
- Follow notification includes follower name and `data.richText`.
- New product notification includes artist + product in message and `data.richText`.
- Broadcast content remains unchanged (plain admin message).

Index suggestions for timeline scalability (optional):
- `notifications(type, createdAt)`
- `user_notifications(createdAt, readAt, deletedAt)`
- Follow/purchase/new product events enqueue notifications with dedupe keys.

## Dev smoke script

Quick check (no endpoint):

```
NOTIFICATIONS_SMOKE_USER_ID=<user-id> npx ts-node scripts/notifications-smoke.ts
```
