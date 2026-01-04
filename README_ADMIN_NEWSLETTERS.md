# Admin Newsletters

## Overview
Admin moderation endpoints are available under `GET/POST/PATCH /api/admin/newsletters` for listing, reading, editing, and moderating any newsletter issue.

Endpoints:
- `GET /api/admin/newsletters`
- `GET /api/admin/newsletters/:id`
- `PATCH /api/admin/newsletters/:id`
- `POST /api/admin/newsletters/:id/approve`
- `POST /api/admin/newsletters/:id/reject`
- `POST /api/admin/newsletters/:id/archive`
- `POST /api/admin/newsletters/:id/unarchive`

## Status Workflow
`DRAFT` -> `PENDING` -> `APPROVED`
`DRAFT/PENDING` -> `REJECTED`
`APPROVED` -> `ARCHIVED` -> `APPROVED` (or `PENDING` if never published)

Admin actions update moderation metadata: `reviewedAt`, `reviewedByAdminId`, `rejectReason`, `archivedAt`, `publishedAt`.

## Pin Feature
- Limitation: only one newsletter can be pinned at a time.
- Pinning a new newsletter automatically unpins the previously pinned newsletter.
- Unpin only affects the target newsletter and does not auto-pin another item.

## Example Requests
List newsletters:
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/api/admin/newsletters?page=1&limit=20&status=APPROVED&sort=createdAt&order=desc"
```

Approve a newsletter:
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/api/admin/newsletters/$NEWSLETTER_ID/approve"
```

Reject a newsletter:
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Needs revisions"}' \
  "$API_BASE/api/admin/newsletters/$NEWSLETTER_ID/reject"
```

## Postman Testing
1) Import `postman/blog-newsletter.postman_collection.json`.
2) Set collection variables:
   - `API_BASE` (e.g. `http://localhost:4000`)
   - `ADMIN_TOKEN`
   - `NEWSLETTER_ID`
3) Use the `Admin / Newsletters` folder for list/detail/edit/approve/reject/archive/unarchive.
4) To test pinning limits, pin one newsletter, then pin a different newsletter and confirm the first is unpinned.

## Notes
- Existing supplier/user newsletter endpoints remain unchanged and backward compatible.
- Migration adds moderation fields and extends `PublicationStatus` with `PENDING`, `APPROVED`, and `REJECTED`.
- Old `PUBLISHED` status is still accepted and treated as publicly visible.
