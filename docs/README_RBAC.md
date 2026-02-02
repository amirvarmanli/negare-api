# RBAC Implementation (Admin/Supplier/User)

## Overview
- Base roles: admin, supplier, user (via `RoleName` enum).
- Extra permissions are stored per user and merged with role permissions.
- Effective permissions = role permissions + user extra permissions.
- Admin short-circuit: admins are allowed regardless of required permissions.

## Data Model (Prisma)
- `User.role` (enum `RoleName`) for the base role.
- `Permission` catalog table (`key`, `title`, `group`).
- `UserPermission` join table for per-user permission overrides.

## Permission Catalog
- Single source of truth: `apps/api/src/common/authz/permissions.catalog.ts`.
- Seeded into DB via `scripts/seed-permissions.ts` (idempotent upsert).
- Role map is defined in the same file (`ROLE_PERMISSIONS`).

## Effective Permissions
- Guard computes: `rolePermissions ∪ userExtraPermissions`.
- `admin` users bypass permission checks (short-circuit allow).
- Route permissions are ANDed (all required keys must be present).

## Running Migrations + Seed
```
# migrations
npx prisma migrate dev --schema prisma/schema.prisma

# seed permissions catalog
npx ts-node -r tsconfig-paths/register scripts/seed-permissions.ts
```

## RBAC Endpoints
- `GET /admin/me` (requires `admin.users:read`)
- `GET /admin/permissions` (requires `admin.users:manage`)
- `PATCH /admin/users/:id/permissions` (requires `admin.users:manage`)
- `PATCH /admin/users/:id/role` (requires `admin.users:manage`)

## Using @Permissions in Controllers
```ts
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { Permissions } from '@app/common/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('admin.blog:manage')
@Get('admin/blog/posts')
listPosts() {
  // ...
}
```

## Postman
- Collection updated: `postman/negare.postman_collection.json`.
- New folder: `Admin RBAC`.
- Variables: `baseUrl`, `accessToken`, `userId`.

## Manual Test Checklist
- Run migrations + seed script.
- Login and set `accessToken` in Postman.
- Call `GET /admin/me` and verify role + permissions list.
- Call `GET /admin/permissions` as admin.
- Grant a permission to a non-admin user and verify they can access a protected admin route.
- Update a user role and verify new effective permissions.
