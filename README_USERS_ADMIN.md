# Admin Users Management

## Overview
Adds admin panel endpoints to manage users with pagination, filtering, and creation. All endpoints are protected by JWT + `PermissionsGuard` and require the `admin.users:read` or `admin.users:manage` permissions.

## Artist Definition
A user is considered an artist/supplier when either:
- `User.role === supplier`, or
- the user has a `user_roles` link to the `supplier` role (legacy support).

## Endpoints
### GET `/admin/users`
Requires: `admin.users:read`

Query params:
- `page` (default 1)
- `limit` (default 20, max 100)
- `q` search across `firstName`, `lastName`, `phone`, `email`, `username`
- `hasProduct` true/false
- `artistOnly` true/false
- `cityId` UUID
- `skillIds` CSV or repeated params (`skillIds=...&skillIds=...`)
- `sortBy` = `createdAt|firstName|lastName|productsCount|cityName`
- `sortDir` = `asc|desc`
- `includeSkills` true/false (default false)
- `includeCity` true/false (default true)

Response:
```json
{
  "items": [
    {
      "id": "...",
      "username": "...",
      "firstName": "...",
      "lastName": "...",
      "phone": "...",
      "email": "...",
      "avatarUrl": "...",
      "bio": "...",
      "role": "supplier",
      "city": { "id": "...", "name": "Tehran" },
      "productsCount": 3,
      "skills": [{ "id": "...", "name": "Illustration", "slug": "illustration" }],
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### POST `/admin/users`
Requires: `admin.users:manage`

Body:
```json
{
  "avatarUrl": "https://cdn.example.com/avatars/user.png",
  "username": "admin_created",
  "firstName": "Admin",
  "lastName": "User",
  "phone": "+989121234567",
  "cityId": null,
  "bio": "Created from admin panel",
  "email": "admin_created@example.com",
  "password": "Password123",
  "passwordConfirm": "Password123",
  "role": "user"
}
```

Notes:
- Passwords are hashed with bcrypt.
- Unique constraints: username, email, phone.

### GET `/admin/users/filters`
Requires: `admin.users:read`

Returns lists used for filters:
- cities
- skills (skill `slug` = `Skill.key`)

## Data Model Notes
- `User` now includes `firstName`, `lastName`, `cityId` (nullable).
- `City` is stored in `core.cities` with `id`, `name`, `province`.
- Products count is based on `product_suppliers` relation.
- Skills come from `core.skills` via `core.user_skills`.

## Performance Notes
- Unique indexes already cover `username`, `email`, `phone`.
- Consider adding indexes for `firstName` and `lastName` if search volume grows.
- Sorting by `cityName` relies on the city relation.

## Manual Test Checklist
- Run migrations.
- Seed permissions + create an admin token.
- Call `GET /admin/users` with filters and verify pagination.
- Create a user via `POST /admin/users` and verify no password hash returned.
- Use `GET /admin/users/filters` to fetch cities/skills.
