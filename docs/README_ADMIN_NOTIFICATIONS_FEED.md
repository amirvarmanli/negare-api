# Admin Notifications Feed (Outbox)

## Overview
Adds an admin-only feed that lists each notification delivery per recipient, including recipient identity, message, sent/read times, and optional product link metadata. Admins can soft-delete individual delivery rows. Broadcast deliveries are always excluded to keep the feed usable.

## Data model changes
- `Notification` now includes optional link metadata: `entityType`, `entitySlug`, `entityId`, `href`.
- `UserNotification` now includes `deletedAt` for admin-only soft delete of deliveries.

## Endpoints

### GET `/admin/notifications/feed`
Requires: `admin.notifications:read`

Query params:
- `page` (default 1)
- `limit` (default 20, max 100)
- `q` search across notification `title/body` and recipient identity (name/username/email/phone)
- `read` = `all|read|unread` (default `all`)
- `type` = `NotificationType`
- `recipientId` = user id
- `includeDeleted` = boolean (default false)

Response:
```json
{
  "items": [
    {
      "id": "user-notification-uuid",
      "message": "You have a new notification.",
      "type": "PURCHASED_YOUR_PRODUCT",
      "sentAt": "2025-01-01T10:00:00.000Z",
      "readAt": "2025-01-01T10:05:00.000Z",
      "link": {
        "entityType": "PRODUCT",
        "entitySlug": "vector-pack-2024",
        "href": null
      },
      "recipient": {
        "id": "user-uuid",
        "fullName": "Negare User",
        "avatarUrl": "https://cdn.negare.test/avatar.png",
        "email": "user@negare.test",
        "phone": null
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### DELETE `/admin/notifications/feed/:recipientRowId`
Requires: `admin.notifications:read`

Soft-deletes the recipient delivery by setting `deletedAt`.
Deleted rows are excluded from the user inbox/unread counts and from the admin feed.

Response:
```json
{ "success": true }
```

## UI route
Admin UI should render the feed at `/admin/notifications/feed` and use the link metadata (`entityType/entitySlug/href`) to build product links. This API repo does not include the Next.js admin UI, so only backend changes are present here.

## How to test
1) Run migrations:
```
npm run prisma:migrate:dev
```
2) Start the API:
```
npm run start:dev
```
3) Fetch the feed:
```
curl -H "Authorization: Bearer <adminToken>" \
  "{{baseUrl}}/admin/notifications/feed?page=1&limit=20&read=all"
```
4) Soft delete a delivery:
```
curl -X DELETE -H "Authorization: Bearer <adminToken>" \
  "{{baseUrl}}/admin/notifications/feed/<recipientRowId>"
```

Postman: see `postman/negare.postman_collection.json` for the new requests.
