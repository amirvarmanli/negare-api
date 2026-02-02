DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'finance_payment_fulfillment_status_enum'
      AND n.nspname = 'finance'
  ) THEN
    CREATE TYPE finance.finance_payment_fulfillment_status_enum AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'order_request_payment_fulfillment_status_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.order_request_payment_fulfillment_status_enum AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
  END IF;
END $$;

ALTER TABLE finance.payments
  ADD COLUMN IF NOT EXISTS fulfillment_status finance.finance_payment_fulfillment_status_enum NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS fulfillment_error varchar(1000),
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz(6);

ALTER TABLE public.order_request_payments
  ADD COLUMN IF NOT EXISTS fulfillment_status public.order_request_payment_fulfillment_status_enum NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS fulfillment_error varchar(1000),
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz(6);

CREATE INDEX IF NOT EXISTS "payments_status_fulfillment_idx"
  ON finance.payments(status, fulfillment_status);

CREATE INDEX IF NOT EXISTS "order_request_payments_fulfillment_idx"
  ON public.order_request_payments(status, fulfillment_status);
