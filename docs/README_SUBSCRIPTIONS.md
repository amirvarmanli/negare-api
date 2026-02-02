# Subscription System (Backend)

This document describes the subscription foundation implemented in the backend.

## Subscription Rules
- Admins manage subscription plans (create/update/delete).
- Each plan defines: title, price, durationDays, daily limits, description, isActive, and optional discountPercent/discountQuota.
- A user can have only one ACTIVE subscription at a time.
- A new subscription purchase is rejected if an ACTIVE subscription exists.
- On purchase:
  - startAt = now
  - endAt = startAt + durationDays
  - discountRemaining = plan.discountQuota (or 0)
- Subscription purchases reference `finance.subscription_plans_v2` via
  `finance.subscription_purchases.subscription_plan_id`.

## Download Limits
- Users without subscription:
  - Can download FREE products only.
  - Daily limit = 15 downloads.
- Users with ACTIVE subscription:
  - Can download SUBSCRIPTION products with dailySubscriptionDownloadLimit.
  - Can download FREE products with dailyFreeDownloadLimitWithSubscription (must be lower than 15).
- Every successful download is logged and validated against daily limits.
- Download logs are the single source of truth for limits and settlement.

## Discount Usage
- If the user has an ACTIVE subscription with discountRemaining > 0:
  - PAID product purchases can apply discountPercent.
  - After a successful discounted purchase, discountRemaining is decreased by 1.

## Settlement Logic
- Settlement runs only when a subscription expires.
- Settlement is based on SUBSCRIPTION download logs inside the subscription period.
- Revenue split:
  - 70% suppliers
  - 30% platform
- For each expired subscription:
  - totalDownloads is calculated from subscription download logs.
  - supplier share is proportional to their download count.
  - If totalDownloads = 0, the full subscription price goes to the platform.
- Settlement results are persisted in subscription settlement tables.
