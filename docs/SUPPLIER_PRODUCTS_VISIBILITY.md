# Supplier Products Visibility

## Visible statuses
- `ProductStatus.DRAFT` — supplier-created drafts that are still awaiting review.
- `ProductStatus.PUBLISHED` — approved products already visible to shoppers.
- `ProductStatus.ARCHIVED` remains hidden by default but can be fetched explicitly via `status=ARCHIVED`.

## Filters & scope
- The supplier list endpoint injects a default `status` filter for owner scope so drafts and published items are returned together without any additional query parameters.
- Passing `status` overrides the default (e.g., `status=ARCHIVED` lets suppliers inspect archived work).
- Ownership is enforced server-side via `supplierLinks`, so suppliers only see their own drafts/published products.
- Existing sorting (`pinnedAt` desc nulls last, then `sortBy`/`sortDir`) is preserved for the expanded set of statuses.

## Response helpers (used by the dashboard)
- `status` — the `ProductStatus` enum value.
- `isPublished` — `true` when `status === ProductStatus.PUBLISHED`.
- `isDraft` — `true` when `status === ProductStatus.DRAFT`.
- `isPendingApproval` — alias of `isDraft` for clarity.
- `statusLabel` — one of `pending_approval`, `approved`, or `archived` for quick UI badges.

### Example snippet
```json
{
  "status": "DRAFT",
  "isPublished": false,
  "isDraft": true,
  "isPendingApproval": true,
  "statusLabel": "pending_approval"
}
```
