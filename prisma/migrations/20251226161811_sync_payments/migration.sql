DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'subscription_purchases_user_created_idx'
      AND n.nspname = 'finance'
  ) THEN
    ALTER INDEX "finance"."subscription_purchases_user_created_idx"
      RENAME TO "subscription_purchases_user_id_created_at_idx";
  END IF;
END $$;
