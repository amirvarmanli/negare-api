# Admin Blogs

## Overview
Admin moderation endpoints are available under `GET/POST/PATCH /api/admin/blogs` for listing, reading, editing, and moderating any blog post.

Endpoints:
- `GET /api/admin/blogs`
- `GET /api/admin/blogs/:id`
- `PATCH /api/admin/blogs/:id`
- `POST /api/admin/blogs/:id/approve`
- `POST /api/admin/blogs/:id/reject`
- `POST /api/admin/blogs/:id/archive`
- `POST /api/admin/blogs/:id/unarchive`

## Status Workflow
`DRAFT` -> `PENDING` -> `APPROVED`
`DRAFT/PENDING` -> `REJECTED`
`APPROVED` -> `ARCHIVED` -> `APPROVED` (or `PENDING` if never published)

Admin actions update moderation metadata: `reviewedAt`, `reviewedByAdminId`, `rejectReason`, `archivedAt`, `publishedAt`.

## Pin Feature
- Limitation: only one blog can be pinned at a time.
- Pinning a new blog automatically unpins the previously pinned blog.
- Unpin only affects the target blog and does not auto-pin another item.

## Example Requests
List blogs:
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/api/admin/blogs?page=1&limit=20&status=APPROVED&sort=createdAt&order=desc"
```

Approve a blog:
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/api/admin/blogs/$BLOG_ID/approve"
```

Reject a blog:
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Needs revisions"}' \
  "$API_BASE/api/admin/blogs/$BLOG_ID/reject"
```

## Postman Testing
1) Import `postman/blog-newsletter.postman_collection.json`.
2) Set collection variables:
   - `API_BASE` (e.g. `http://localhost:4000`)
   - `ADMIN_TOKEN`
   - `BLOG_ID`
3) Use the `Admin / Blogs` folder for list/detail/edit/approve/reject/archive/unarchive.
4) To test pinning limits, pin one blog, then pin a different blog and confirm the first is unpinned.

## Notes
- Existing supplier/user blog endpoints remain unchanged and backward compatible.
- Migration adds moderation fields and extends `PublicationStatus` with `PENDING`, `APPROVED`, and `REJECTED`.
- Old `PUBLISHED` status is still accepted and treated as publicly visible.
