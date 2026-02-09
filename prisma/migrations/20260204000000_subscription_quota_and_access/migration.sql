DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'CANCELLED'
      AND enumtypid = 'finance.finance_subscription_status_enum'::regtype
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'CANCELED'
      AND enumtypid = 'finance.finance_subscription_status_enum'::regtype
  ) THEN
    ALTER TYPE finance.finance_subscription_status_enum
      RENAME VALUE 'CANCELLED' TO 'CANCELED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'PAUSED'
      AND enumtypid = 'finance.finance_subscription_status_enum'::regtype
  ) THEN
    ALTER TYPE finance.finance_subscription_status_enum ADD VALUE 'PAUSED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'subscription_download_status_enum'
      AND typnamespace = 'finance'::regnamespace
  ) THEN
    CREATE TYPE finance.subscription_download_status_enum AS ENUM (
      'SUCCESS',
      'FAILED'
    );
  END IF;
END $$;

ALTER TABLE finance.subscription_plans_v2
  ADD COLUMN IF NOT EXISTS features jsonb;

ALTER TABLE finance.subscription_download_logs
  ADD COLUMN IF NOT EXISTS is_subscription_download boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status finance.subscription_download_status_enum DEFAULT 'SUCCESS',
  ADD COLUMN IF NOT EXISTS fail_reason varchar(255),
  ADD COLUMN IF NOT EXISTS ip varchar(64),
  ADD COLUMN IF NOT EXISTS user_agent varchar(255);

ALTER TABLE finance.user_subscriptions_v2
  ADD COLUMN IF NOT EXISTS auto_renew boolean;

CREATE INDEX IF NOT EXISTS subscription_download_logs_user_created_idx
  ON finance.subscription_download_logs(user_id, created_at);

CREATE TABLE IF NOT EXISTS finance.subscription_daily_quota_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date_key varchar(10) NOT NULL,
  downloads_used integer NOT NULL DEFAULT 0,
  downloads_limit_snapshot integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_daily_quota_usage_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES core.users(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_daily_quota_usage_user_date_idx
  ON finance.subscription_daily_quota_usage(user_id, date_key);

CREATE TABLE IF NOT EXISTS finance.subscription_plan_product_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  product_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plan_product_access_plan_id_fkey
    FOREIGN KEY (plan_id)
    REFERENCES finance.subscription_plans_v2(id)
    ON DELETE CASCADE,
  CONSTRAINT subscription_plan_product_access_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES catalog.products(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plan_product_access_plan_product_idx
  ON finance.subscription_plan_product_access(plan_id, product_id);

CREATE INDEX IF NOT EXISTS subscription_plan_product_access_product_idx
  ON finance.subscription_plan_product_access(product_id);

CREATE TABLE IF NOT EXISTS finance.subscription_plan_category_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  category_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plan_category_access_plan_id_fkey
    FOREIGN KEY (plan_id)
    REFERENCES finance.subscription_plans_v2(id)
    ON DELETE CASCADE,
  CONSTRAINT subscription_plan_category_access_category_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES catalog.categories(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plan_category_access_plan_category_idx
  ON finance.subscription_plan_category_access(plan_id, category_id);

CREATE INDEX IF NOT EXISTS subscription_plan_category_access_category_idx
  ON finance.subscription_plan_category_access(category_id);
