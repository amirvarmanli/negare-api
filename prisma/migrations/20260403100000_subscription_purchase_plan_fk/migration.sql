ALTER TABLE finance.subscription_purchases
  ALTER COLUMN plan_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'finance'
      AND table_name = 'subscription_purchases'
      AND column_name = 'subscription_plan_id'
  ) THEN
    ALTER TABLE finance.subscription_purchases
      ADD COLUMN subscription_plan_id uuid;
  END IF;
END $$;

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
        ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'subscription_purchases_subscription_plan_id_idx'
      AND n.nspname = 'finance'
  ) THEN
    CREATE INDEX subscription_purchases_subscription_plan_id_idx
      ON finance.subscription_purchases(subscription_plan_id);
  END IF;
END $$;
