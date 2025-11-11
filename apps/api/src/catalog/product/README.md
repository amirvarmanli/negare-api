# Product ↔ ProductFile Linking

## Relation strategy
- Prisma keeps a 1:1 optional relation: `Product.fileId BigInt? @unique` ↔ `ProductFile.product`.
- Multiple products cannot point to the same file because of the unique `fileId`.
- Leaving `fileId` empty on create keeps the product publishable without an asset; sending `null` during update disconnects the current file.

## Accepted inputs
- `fileId`: numeric string that references an existing `ProductFile`. Validated via `productFile.findUnique` before connect.
- `file`: inline payload (`storageKey`, optional `originalName`, `size` as string, `mimeType`, `meta` object) that creates a new `ProductFile` within the same mutation.
- Create/Update reject payloads that include both `fileId` and `file` (clarity > guessing).
- Update accepts `fileId: null` to drop the relation without creating a new record.

## Errors & guarantees
- Invalid IDs → `400 BadRequestException` with `Invalid fileId: ProductFile not found`.
- Mixing strategies → `400 BadRequestException` with `Provide either fileId or file, not both.`.
- One-to-one integrity: no nested connect happens unless the target exists; nested create always initializes a brand-new `product_files` row.

## Tests
- Coverage lives in `apps/api/test/catalog/product/product.service.spec.ts`.
- Run `npm run test -- apps/api/test/catalog/product/product.service.spec.ts` to execute only these guards.
- Cases include: create/update via fileId, nested file create, disconnect, and invalid inputs.

## API docs & clients
- Swagger (`http://localhost:3000/api/docs`) reflects the dual input options on `POST/PATCH /catalog/products`.
- Postman collection: `postman/catalog.postman_collection.json` now bundles samples for connect, nested create, optional create-without-file, and the update permutations.
