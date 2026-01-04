# Catalog Admin & Supplier Management

This document covers the new RBAC-protected catalog management endpoints for admins and suppliers.

## RBAC permissions

- admin.products:read
- admin.products:manage
- admin.categories:manage
- supplier.products:read
- supplier.products:manage

## Admin products

Base path: `/admin/products`

- GET `/admin/products` (admin.products:read)
- GET `/admin/products/:id` (admin.products:read)
- POST `/admin/products` (admin.products:manage)
- PATCH `/admin/products/:id` (admin.products:manage)
- DELETE `/admin/products/:id` (admin.products:manage)

List filters for GET `/admin/products`:

- page (default 1)
- limit (default 20, max 100)
- q (search title/slug/description)
- status (any ProductStatus enum)
- ownerId (filter by owner user id)
- topicId (BigInt as string)
- categoryId (BigInt as string)
- tagId (BigInt as string)
- pricingType (PricingType enum)
- sortBy (createdAt|updatedAt|price|views|status)
- sortDir (asc|desc)
- includeOwner (default true)
- includeRelations (default true)

Notes:

- Admins can read/update/delete any product regardless of ownership/status.
- Admin create supports `ownerId` as a shortcut to set the primary author (do not send `authorIds` together with `ownerId`).

## Supplier products

Base path: `/supplier/products`

- GET `/supplier/products` (supplier.products:read)
- GET `/supplier/products/:id` (supplier.products:read)
- POST `/supplier/products` (supplier.products:manage)
- PATCH `/supplier/products/:id` (supplier.products:manage)
- DELETE `/supplier/products/:id` (supplier.products:manage)

Supplier rules:

- Scope is always `ownerId = current user id` (query `ownerId` is ignored).
- If a product is not owned by the supplier, the API returns 404.
- Supplier create always binds the product to the current user.

## Admin topics (CRUD)

Base path: `/admin/topics` (admin.categories:manage)

- GET `/admin/topics`
- POST `/admin/topics`
- GET `/admin/topics/:id`
- PATCH `/admin/topics/:id`
- DELETE `/admin/topics/:id`

## Admin categories (CRUD)

Base path: `/admin/categories` (admin.categories:manage)

- GET `/admin/categories`
- POST `/admin/categories`
- GET `/admin/categories/:id`
- PATCH `/admin/categories/:id`
- DELETE `/admin/categories/:id`

## Migrations / seed

- No new migrations required.
- If permissions are missing in the database, run:
  - `npx ts-node scripts/seed-permissions.ts`

## Manual test checklist

- Admin list returns products across all owners/statuses and respects filters.
- Admin can fetch/update/delete any product by id or slug.
- Admin create supports `ownerId` (and rejects `ownerId` + `authorIds`).
- Supplier list returns only owned products and ignores ownerId filter.
- Supplier cannot access non-owned products (404).
- Supplier create/update keeps ownership bound to current user.
- Admin topics/categories CRUD works and preserves public `/catalog/*` behavior.
