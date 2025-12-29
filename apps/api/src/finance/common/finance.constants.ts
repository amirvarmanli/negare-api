import { SubscriptionPlanCode } from '@app/finance/common/finance.enums';

export const BASE_FREE_DAILY_LIMIT = 10;

export const SUBSCRIPTION_PLANS = {
  [SubscriptionPlanCode.A]: {
    code: SubscriptionPlanCode.A,
    dailySubLimit: 2,
    dailyFreeLimit: 15,
  },
  [SubscriptionPlanCode.B]: {
    code: SubscriptionPlanCode.B,
    dailySubLimit: 5,
    dailyFreeLimit: 20,
  },
  [SubscriptionPlanCode.C]: {
    code: SubscriptionPlanCode.C,
    dailySubLimit: 8,
    dailyFreeLimit: 25,
  },
} as const;

export const SUBSCRIPTION_DURATIONS_MONTHS = [1, 3, 9] as const;

export const SUBSCRIPTION_PLAN_PRICING: Record<SubscriptionPlanCode, number> = {
  [SubscriptionPlanCode.A]: 150000,
  [SubscriptionPlanCode.B]: 250000,
  [SubscriptionPlanCode.C]: 350000,
};

export const DOWNLOAD_TOKEN_TTL_SECONDS = 10 * 60;
export const ORDER_PAYMENT_TTL_MINUTES = 15;
