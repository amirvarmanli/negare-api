ALTER TABLE finance.subscription_purchases
  ALTER COLUMN plan_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS subscription_plan_id uuid;

ALTER TABLE finance.subscription_purchases
  ADD CONSTRAINT IF NOT EXISTS subscription_purchases_subscription_plan_id_fkey
    FOREIGN KEY (subscription_plan_id)
    REFERENCES finance.subscription_plans_v2(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "subscription_purchases_subscription_plan_id_idx"
  ON finance.subscription_purchases(subscription_plan_id);
