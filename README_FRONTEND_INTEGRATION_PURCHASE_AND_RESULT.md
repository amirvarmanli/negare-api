# Frontend Integration Guide: Purchase Awareness + Payment Result

This document maps the current backend behavior to a Next.js App Router frontend. It references real endpoints and DTO shapes in this codebase.

## Part A: Purchased Product Awareness (`hasPurchased`)

### 1) Endpoints that return `hasPurchased`

**Product list**
- `GET /catalog/products`
- DTO: `ProductBriefDto` includes `hasPurchased: boolean` per item.

**Product detail**
- `GET /catalog/products/:id`
- `GET /catalog/products/slug/:slug`
- DTO: `ProductDetailDto` includes `hasPurchased: boolean`.

**Purchases list (for downloads & ownership context)**
- `GET /me/purchases?page=1&pageSize=20`
- DTO: `PurchaseResultDto` includes `items[]` with `productId`, `downloads[]`.

### 2) DTO fields you should expect

**`ProductBriefDto` / `ProductDetailDto` (relevant fields)**
```json
{
  "id": "1024",
  "title": "شهید محمدحسین بهشتی",
  "pricingType": "PAID",
  "price": 250000,
  "hasPurchased": true,
  "isLikedByCurrentUser": false,
  "isBookmarkedByCurrentUser": false
}
```

**`PurchaseResultDto` (items excerpt)**
```json
{
  "items": [
    {
      "productId": "1024",
      "downloads": [
        {
          "fileId": "42",
          "url": "http://localhost:4000/api/downloads/files/42?token=...",
          "expiresAt": "2025-01-01T12:10:00.000Z"
        }
      ]
    }
  ]
}
```

### 3) Recommended frontend data-fetch strategy (avoid N+1)
- **Lists:** rely on `GET /catalog/products` which already includes `hasPurchased`.
- **Detail:** use `GET /catalog/products/:id` or slug endpoint, which includes `hasPurchased`.
- **Downloads:** for paid products, use `GET /me/purchases` to retrieve secure download URLs.

### 4) Minimal typed TypeScript example (no `any`)
```ts
// types.ts
export type ProductPricingType = 'FREE' | 'PAID' | 'PAID_OR_SUBSCRIPTION';

export type ProductDto = {
  id: string;
  title: string;
  pricingType: ProductPricingType;
  price?: number | null;
  hasPurchased?: boolean;
};

export type ProductListResponse = {
  items: ProductDto[];
  nextCursor?: string;
};

// api.ts
export async function fetchProduct(id: string, token?: string): Promise<ProductDto> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/catalog/products/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to load product');
  return (await res.json()) as ProductDto;
}

export async function fetchProducts(query: string, token?: string): Promise<ProductListResponse> {
  const url = new URL(`${process.env.NEXT_PUBLIC_API_BASE}/catalog/products`);
  url.searchParams.set('q', query);
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to load products');
  return (await res.json()) as ProductListResponse;
}

// UI decision table
// hasPurchased === true  => show "Purchased" + downloads
// hasPurchased === false => show add-to-cart or free-download based on pricingType
// hasPurchased === undefined => show skeleton/disabled actions
```

### 5) Caching rules
- After a successful payment, **invalidate product list and detail caches**.
- Recommended: call `GET /payments/:id/result` and then refetch:
  - `GET /catalog/products` (lists)
  - `GET /catalog/products/:id` (detail)
- If entitlements are eventually consistent, retry purchase check with backoff (see edge cases).

### Edge cases
- **Not logged in:** `hasPurchased` may be `false` or omitted. UI should assume not purchased but keep CTA gated behind login where required.
- **Payment success but entitlement delay:** retry `GET /catalog/products/:id` or `GET /me/purchases` with a short backoff (e.g., 1s, 2s, 3s).
- **Multiple files:** use the `downloads[]` array from `GET /me/purchases` and render all files.

---

## Part B: Payment Result Page (`/payment/result`)

### 1) Canonical gateway redirect URL
The backend redirects to:
- `/payment/result?status=success|failed&paymentId=...&orderId=...&trackId=...`

From `PaymentsController.buildFrontendRedirectUrl()`.

### 2) Backend endpoints to resolve results

**Primary result lookup**
- `GET /payments/:id/result` (auth required)
- DTO: `PaymentResultDto`

**Donation result**
- Use `GET /payments/:id/result` (auth required)
- DTO: `PaymentResultDto` with `purpose: DONATION`

**Purchase result**
- `GET /orders/:id/purchase-result` (auth required)
- DTO: `PurchaseResultDto`

### 3) Response DTO examples

**Payment result (purchase or wallet)**
```json
{
  "purpose": "ORDER",
  "status": "SUCCESS",
  "amountToman": 250000,
  "messageFa": "پرداخت با موفقیت انجام شد.",
  "orderId": "order-uuid",
  "canAccessDownloads": true
}
```

**Wallet topup result**
```json
{
  "purpose": "WALLET_TOPUP",
  "status": "SUCCESS",
  "amountToman": 200000,
  "messageFa": "شارژ کیف پول با موفقیت انجام شد.",
  "walletBalanceToman": 500000,
  "topupAmountToman": 200000
}
```

**Donation result (via /payments/:id/result)**
```json
{
  "purpose": "DONATION",
  "status": "SUCCESS",
  "amountToman": 50000,
  "messageFa": "پرداخت حمایت با موفقیت انجام شد."
}
```

### 4) Frontend flow diagram
1) Parse query params: `status`, `paymentId`, `orderId`, `trackId`.
2) Call `GET /payments/:id/result` (auth required).
3) Based on `purpose` + `status`:
   - `ORDER` + `SUCCESS`: call `GET /orders/:id/purchase-result` for downloads.
   - `WALLET_TOPUP`: render balance + amount.
   - `DONATION`: render donation UI from `amountToman` + `messageFa`.
4) Invalidate caches:
   - Products list/detail
   - Wallet balance
   - Purchases list

### 5) Minimal Next.js page example (typed, no `any`)
```ts
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type PaymentPurpose = 'ORDER' | 'WALLET_TOPUP' | 'DONATION';
type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELED';

type PaymentResult = {
  purpose: PaymentPurpose;
  status: PaymentStatus;
  amountToman: number;
  messageFa: string;
  orderId?: string | null;
  canAccessDownloads?: boolean;
  walletBalanceToman?: number;
  topupAmountToman?: number;
};

type PurchaseResult = {
  items: Array<{ productId: string; downloads: Array<{ url: string }> }>;
};

export function PaymentResultPage({ token }: { token: string }) {
  const params = useSearchParams();
  const paymentId = params.get('paymentId');
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [purchase, setPurchase] = useState<PurchaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;
    const run = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/payments/${paymentId}/result`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Payment result failed');
        const data = (await res.json()) as PaymentResult;
        setResult(data);

        if (data.purpose === 'ORDER' && data.orderId) {
          const pr = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/orders/${data.orderId}/purchase-result`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (pr.ok) setPurchase((await pr.json()) as PurchaseResult);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };
    void run();
  }, [paymentId, token]);

  if (!paymentId) return <div>Invalid result link.</div>;
  if (error) return <div>{error}</div>;
  if (!result) return <div>Loading...</div>;

  if (result.status !== 'SUCCESS') {
    return <div>Payment failed: {result.messageFa}</div>;
  }

  if (result.purpose === 'WALLET_TOPUP') {
    return <div>Wallet charged. Balance: {result.walletBalanceToman}</div>;
  }

  if (result.purpose === 'ORDER') {
    return <div>Thanks! Downloads: {purchase ? purchase.items.length : 0}</div>;
  }

  return <div>{result.messageFa}</div>;
}
```

### Security & correctness notes
- Do not trust query params; always resolve via backend.
- `/payments/:id/result` and `/orders/:id/purchase-result` require auth.
- Never expose download URLs to unauthenticated users.
- Use signed URLs only after backend verification.

### Testing instructions

**Postman requests**
- Purchase result: `GET /payments/{{PAYMENT_ID}}/result`
- Purchase downloads: `GET /orders/{{ORDER_ID}}/purchase-result`
- Wallet result: `GET /payments/{{PAYMENT_ID}}/result`
- Donation result: `GET /payments/{{PAYMENT_ID}}/result` (purpose = DONATION)

**Frontend checklist**
- Product list shows correct `hasPurchased` state.
- Product detail shows correct `hasPurchased` state and download CTA.
- After payment success, product detail/list updates without stale CTA.
- Wallet topup shows updated balance.
- Donation result shows thank you + amount.
- Failed payment renders safe error state and no downloads.
