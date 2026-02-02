# Admin User Role API

## Endpoint

- **Method**: `PATCH`
- **Path**: `/api/admin/users/:id/role`
- **Auth**: Bearer token (admin-level, `admin.users:manage`.)
- **Body**:
  ```json
  {
    "role": "supplier"
  }
  ```

The request body is validated against the Prisma `RoleName` enum, so the API trims the input, then lowercases it before comparing to the allowed values.

## Allowed role values (case-sensitive)

- `user`
- `supplier`
- `admin`

When validation fails an active error will look like:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_ROLE",
    "message": "Invalid role. Must be one of: user, supplier, admin",
    "meta": {
      "allowed": ["user", "supplier", "admin"]
    }
  },
  "traceId": "<uuid>"
}
```

## Example

```bash
curl -X PATCH http://localhost:4000/api/admin/users/123e4567-e89b-12d3-a456-426614174000/role \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"supplier"}'
```
