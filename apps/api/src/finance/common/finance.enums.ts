import { CouponValueType as PrismaCouponValueType } from '@prisma/client';

export enum ProductPricingType {
  FREE = 'FREE',
  PAID = 'PAID',
  PAID_OR_SUBSCRIPTION = 'PAID_OR_SUBSCRIPTION',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export enum OrderKind {
  PRODUCT = 'PRODUCT',
  SUBSCRIPTION = 'SUBSCRIPTION',
  TOPUP = 'TOPUP',
}

export enum DiscountType {
  NONE = 'NONE',
  FIXED = 'FIXED',
  PERCENT = 'PERCENT',
  COUPON = 'COUPON',
}

export const CouponValueType = PrismaCouponValueType;
export type CouponValueType = PrismaCouponValueType;

export enum PaymentProvider {
  MOCK = 'MOCK',
  ZIBAL = 'ZIBAL',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

export enum PaymentSource {
  WALLET = 'WALLET',
  GATEWAY = 'GATEWAY',
}

export enum PaymentFulfillmentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum PaymentPurpose {
  ORDER = 'ORDER',
  WALLET_TOPUP = 'WALLET_TOPUP',
  DONATION = 'DONATION',
}

export enum PaymentReferenceType {
  CART = 'cart',
  SUBSCRIPTION = 'subscription',
  WALLET_CHARGE = 'wallet_charge',
  DONATION = 'donation',
}

export enum DonationStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum WalletTransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum WalletTransactionReason {
  TOPUP = 'TOPUP',
  ORDER_PAYMENT = 'ORDER_PAYMENT',
  PLATFORM_DISCOUNT = 'PLATFORM_DISCOUNT',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
  WITHDRAWAL = 'WITHDRAWAL',
  DONATION = 'DONATION',
  PHOTO_RESTORE = 'PHOTO_RESTORE',
}

export enum WalletTransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

export enum EntitlementSource {
  PURCHASED = 'PURCHASED',
  SUB_QUOTA = 'SUB_QUOTA',
  FREE_QUOTA = 'FREE_QUOTA',
}

export enum SubscriptionPlanCode {
  A = 'A',
  B = 'B',
  C = 'C',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum RevenuePoolStatus {
  DRAFT = 'DRAFT',
  COMPUTED = 'COMPUTED',
  OPEN = 'OPEN',
  FINALIZED = 'FINALIZED',
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

export enum EarningStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

export enum RevenueBeneficiaryType {
  PLATFORM = 'PLATFORM',
  SUPPLIER = 'SUPPLIER',
}

export enum CartStatus {
  ACTIVE = 'ACTIVE',
  CHECKED_OUT = 'CHECKED_OUT',
  ABANDONED = 'ABANDONED',
}
