ALTER TABLE finance.subscription_purchases
  ALTER COLUMN plan_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS subscription_plan_id uuid;

UPDATE finance.subscription_purchases AS sp
SET subscription_plan_id = sp.plan_id
WHERE sp.subscription_plan_id IS NULL
  AND sp.plan_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM finance.subscription_plans_v2 AS p
    WHERE p.id = sp.plan_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscription_purchases_subscription_plan_id_fkey'
      AND conrelid = 'finance.subscription_purchases'::regclass
  ) THEN
    ALTER TABLE finance.subscription_purchases
      ADD CONSTRAINT subscription_purchases_subscription_plan_id_fkey
      FOREIGN KEY (subscription_plan_id)
      REFERENCES finance.subscription_plans_v2(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscription_purchases_subscription_plan_id_fkey'
      AND conrelid = 'finance.subscription_purchases'::regclass
      AND NOT convalidated
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM finance.subscription_purchases AS sp
      WHERE sp.subscription_plan_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM finance.subscription_plans_v2 AS p
          WHERE p.id = sp.subscription_plan_id
        )
    ) THEN
      ALTER TABLE finance.subscription_purchases
        VALIDATE CONSTRAINT subscription_purchases_subscription_plan_id_fkey;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "subscription_purchases_subscription_plan_id_idx"
  ON finance.subscription_purchases(subscription_plan_id);
