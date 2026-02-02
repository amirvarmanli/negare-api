DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'finance_wallet_transaction_reason_enum'
      AND n.nspname = 'finance'
      AND e.enumlabel = 'DONATION'
  ) THEN
    ALTER TYPE finance.finance_wallet_transaction_reason_enum ADD VALUE 'DONATION';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'finance_wallet_transaction_reason_enum'
      AND n.nspname = 'finance'
      AND e.enumlabel = 'PHOTO_RESTORE'
  ) THEN
    ALTER TYPE finance.finance_wallet_transaction_reason_enum ADD VALUE 'PHOTO_RESTORE';
  END IF;
END $$;
