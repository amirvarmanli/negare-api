import type { FinanceWalletTransactionReason } from '@prisma/client';
import type { WalletTransactionReason } from '@app/finance/common/finance.enums';

const PRODUCT_SALE_DESCRIPTION = 'فروش محصول';

const WALLET_REASON_DISPLAY_MAP: Record<string, string> = {
  PLATFORM_DISCOUNT: 'تخفیف',
  SUPPLIER_PAYOUT: 'تسویه فروشنده',
  PRODUCT_PURCHASE: 'پرداخت سفارش',
  PRODUCT_SALE: 'فروش محصول',
  SALE: 'فروش محصول',
  REFUND: 'بازگشت وجه',
  WITHDRAWAL: 'برداشت',
  TOPUP: 'شارژ کیف پول',
  ADJUSTMENT: 'اصلاح سیستمی موجودی',
  MANUAL_ADJUSTMENT: 'اصلاح دستی توسط پشتیبانی',
  ORDER_PAYMENT: 'پرداخت سفارش',
  DONATION: 'حمایت مالی',
  PHOTO_RESTORE: 'پرداخت ترمیم عکس',
};

const DEFAULT_REASON_LABEL = 'سایر';

export function walletReasonDisplay(
  reason?: WalletTransactionReason | FinanceWalletTransactionReason | string | null,
  description?: string | null,
): string {
  if (description === PRODUCT_SALE_DESCRIPTION) {
    return WALLET_REASON_DISPLAY_MAP.PRODUCT_SALE;
  }
  if (!reason) {
    return DEFAULT_REASON_LABEL;
  }
  const key = reason.toString();
  return WALLET_REASON_DISPLAY_MAP[key] ?? DEFAULT_REASON_LABEL;
}
