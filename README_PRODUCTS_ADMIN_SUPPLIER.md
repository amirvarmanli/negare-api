# Admin + Supplier Products, Topics, Categories

## RBAC permissions

Admin Products:
- GET /admin/products -> admin.products:read
- GET /admin/products/:id -> admin.products:read
- GET /admin/products/:id/download -> admin.products:read
- POST /admin/products -> admin.products:manage
- PATCH /admin/products/:id -> admin.products:manage
- POST /admin/products/:id/bump -> admin.products:manage
- DELETE /admin/products/:id -> admin.products:manage

Supplier Products:
- GET /supplier/products -> supplier.products:read
- GET /supplier/products/:id -> supplier.products:read
- GET /supplier/products/:id/download -> supplier.products:read
- POST /supplier/products -> supplier.products:manage
- PATCH /supplier/products/:id -> supplier.products:manage
- DELETE /supplier/products/:id -> supplier.products:manage

Admin Topics:
- GET /admin/topics -> admin.categories:manage
- GET /admin/topics/:id -> admin.categories:manage
- POST /admin/topics -> admin.categories:manage
- PATCH /admin/topics/:id -> admin.categories:manage
- DELETE /admin/topics/:id -> admin.categories:manage

Admin Categories:
- GET /admin/categories -> admin.categories:manage
- PATCH /admin/categories/reorder -> admin.categories:manage
- GET /admin/categories/:id -> admin.categories:manage
- POST /admin/categories -> admin.categories:manage
- PATCH /admin/categories/:id -> admin.categories:manage
- DELETE /admin/categories/:id -> admin.categories:manage

## Query params

Admin products list (GET /admin/products):
- page (default 1)
- limit (default 20, max 100)
- q (search title/slug/owner fields)
- status (DRAFT|PUBLISHED|ARCHIVED)
- ownerId (UUID)
- categoryId (numeric)
- topicId (numeric)
- sortBy (createdAt|updatedAt|price|views|status)
- sortDir (asc|desc)
- includeOwner (default true)
- includeCategory (default true)
- includeTopic (default true)

Supplier products list (GET /supplier/products):
- page (default 1)
- limit (default 20, max 100)
- q (search title/slug)
- status (DRAFT|PUBLISHED|ARCHIVED)
- categoryId (numeric)
- topicId (numeric)
- sortBy (createdAt|updatedAt|price|views|status)
- sortDir (asc|desc)
- includeCategory (default true)
- includeTopic (default true)

Topics list (GET /admin/topics):
- limit (default 100, max 200)
- q (name/slug)

Categories list (GET /admin/categories):
- returns a nested tree ordered by sortOrder (then id), each node includes sortOrder and children

## Examples

Admin list products (status filter):

```
curl -H "Authorization: Bearer <token>" \
  "{{baseUrl}}/admin/products?page=1&limit=20&status=PUBLISHED&sortBy=createdAt&sortDir=desc"
```

Admin update product:

```
curl -X PATCH -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"title":"Updated title","publishStatus":"PUBLISHED","saleType":"PAID","price":75000}' \
  "{{baseUrl}}/admin/products/<productId>"
```

Supplier list own products:

```
curl -H "Authorization: Bearer <token>" \
  "{{baseUrl}}/supplier/products?page=1&limit=20"
```

Create topic:

```
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"Dashboard Design","slug":"dashboard-design"}' \
  "{{baseUrl}}/admin/topics"
```

Create category:

```
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"Logo & Branding","slug":"logo-branding"}' \
  "{{baseUrl}}/admin/categories"
```

Reorder categories:

```
curl -X PATCH -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"parentId":null,"orderedIds":["1","3","5"]}' \
  "{{baseUrl}}/admin/categories/reorder"
```

## Manual test checklist

- Admin products list returns all statuses and respects filters.
- Admin can fetch any product by id regardless of ownership.
- Admin can create products for another owner via ownerId.
- Admin can update status and relations (category/topic/authorIds).
- Admin can update publishStatus (DRAFT/PUBLISHED/ARCHIVED) and saleType/price rules are enforced.
- Admin can bump a product to the top of the list (pinnedAt is updated on each bump).
- Admin download endpoint streams the product file with Content-Disposition headers.
- Supplier list shows only own products and respects filters.
- Supplier cannot access a product owned by another user.
- Supplier create always links product to current user.
- Delete on admin/supplier archives product (status = ARCHIVED).
- Supplier download endpoint streams the product file with Content-Disposition headers.
- Admin topics and categories CRUD works and enforces permissions.
- Admin categories list returns a tree ordered by sortOrder and respects reordering.
- Update admin/supplier product with colors (including OTHER) and confirm GET returns them.

## Notes

- Admin create/update supports ownerId; if omitted, the current admin user is used.
- Supplier update uses the same product DTO (minus authorIds) and enforces ownership.
- Delete endpoints are implemented as archive (status = ARCHIVED) to avoid destructive deletes.
- Product edit now accepts `OTHER` as a valid colors option alongside HEX `colors`.

## Quick test

1) `npm run start:dev`
2) Postman:
   - Update Admin Product / Update Supplier Product (set `colors` with `OTHER`)
   - Get Admin Product / Get Supplier Product (verify both arrays are returned)
   - Download Admin Product File / Download Supplier Product File (verify 200 + `Content-Disposition`)
