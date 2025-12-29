# Photo Restore Requests (Payment-First) + Zibal

## Overview
This feature implements a payment-first flow for public photo-restore requests. The frontend submits the form data plus a `fileUrl`, the backend creates a payment intent, and only after Zibal verifies a successful payment will the `OrderRequest` record be created.

## Database Migration
1) Apply Prisma migrations:
```
prisma migrate deploy
```
2) Generate Prisma client:
```
prisma generate
```

## Environment Variables
Required:
- `ZIBAL_MERCHANT`
- `ZIBAL_CALLBACK_URL` (e.g. `http://localhost:4000/api/payments/zibal/callback`)

Optional:
- `APP_PUBLIC_BASE_URL` (frontend base for redirect)
- `PHOTO_RESTORE_ALLOWED_DOMAINS` (CSV allowlist for `fileUrl` hostnames)

## Pricing
- Each image costs `700,000` TOMAN.
- `amountToman = imageCount * 700_000`.

## Amount Unit Conversion (Zibal)
- Platform amounts are TOMAN.
- Zibal expects IRR (rial).
- Requests convert using `amountRial = amountToman * 10`.

## API Endpoints (Base: `/api/special/photo-restore`)
- `POST /request-payment`
- `GET /payments/:id`
- `POST /zibal/verify` (dev helper)

Zibal callback is shared with existing payment flows:
- `GET /api/payments/zibal/callback`

## Request Payload (Payment Intent)
```
{
  "fullName": "...",
  "messenger": "telegram" | "eitaa" | "ble",
  "phoneNumber": "09123456789",
  "description": "..."?,
  "imageCount": 3,
  "fileUrl": "https://cdn.example.com/uploads/file.zip"
}
```

Validation:
- `fullName` min 3
- `phoneNumber` matches `^09\d{9}$`
- `imageCount` between 1 and 100
- `fileUrl` must be a valid http/https URL
- If `PHOTO_RESTORE_ALLOWED_DOMAINS` is set, `fileUrl` host must match the allowlist

## Payment Flow
1) Frontend uploads file elsewhere and obtains `fileUrl`
2) Frontend calls `POST /request-payment` and receives `redirectUrl`
3) User pays on Zibal
4) Zibal calls `GET /api/payments/zibal/callback`, backend verifies
5) On success, `OrderRequest` is created from the stored `orderDraft`
6) Frontend polls `GET /payments/:id` or uses redirect params

## Redirect Behavior
If `APP_PUBLIC_BASE_URL` is set and `Accept` does not request JSON, the callback will redirect to:
```
<APP_PUBLIC_BASE_URL>/special/photo-restore/result?status=success|failed|pending&paymentId=...&orderRequestId=...&trackId=...
```

## Local Testing (Postman)
Use `postman/OrderRequests.postman_collection.json`:
1) Request payment
2) Capture `paymentId` and `trackId`
3) Open `redirectUrl` to pay
4) Simulate callback or verify by paymentId
