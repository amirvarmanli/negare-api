# Admin Notifications Broadcasts

## Overview
Admin broadcast notifications are treated as a single announcement item. The broadcasts list returns one row per notification with sender identity, message, and sent time. Deleting a broadcast removes it for all users.

## Endpoints

### GET `/admin/notifications/broadcasts`
Requires: `admin.notifications:read`

Query params:
- `page` (default 1)
- `limit` (default 20, max 100)

Response:
```json
{
  "items": [
    {
      "id": "notification-uuid",
      "type": "ADMIN_BROADCAST",
      "message": "Broadcast message body",
      "sentAt": "2025-01-01T10:00:00.000Z",
      "sender": {
        "id": "admin-uuid",
        "fullName": "Negare Admin",
        "avatarUrl": "https://cdn.negare.test/avatar.png",
        "email": "admin@negare.test",
        "phone": "+989121234567"
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### DELETE `/admin/notifications/broadcasts/:notificationId`
Requires: `admin.notifications:read`

Deletes the broadcast notification globally by removing all related delivery rows and the notification itself.

Response:
```json
{ "success": true }
```

## How to test
1) Create a broadcast notification via `POST /admin/notifications/broadcast`.
2) List broadcasts:
```
curl -H "Authorization: Bearer <adminToken>" \
  "{{baseUrl}}/admin/notifications/broadcasts?page=1&limit=20"
```
3) Delete a broadcast:
```
curl -X DELETE -H "Authorization: Bearer <adminToken>" \
  "{{baseUrl}}/admin/notifications/broadcasts/<notificationId>"
```

Postman: see `postman/negare.postman_collection.json`.
