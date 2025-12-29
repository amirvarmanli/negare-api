-- Ensure required schemas exist for shadow DB runs
CREATE SCHEMA IF NOT EXISTS "core";
CREATE SCHEMA IF NOT EXISTS "finance";

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'finance'
          AND table_name = 'payments'
          AND column_name = 'reference_type'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'finance'
              AND t.typname = 'finance_payment_reference_type_enum'
        ) THEN
            CREATE TYPE "finance"."finance_payment_reference_type_enum" AS ENUM (
                'cart',
                'subscription',
                'wallet_charge'
            );
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'finance'
              AND t.typname = 'finance_subscription_purchase_status_enum'
        ) THEN
            CREATE TYPE "finance"."finance_subscription_purchase_status_enum" AS ENUM (
                'PENDING',
                'PAID',
                'FAILED',
                'CANCELED'
            );
        END IF;

        -- Update payment status enum values if still on the legacy set.
        IF EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'finance'
              AND t.typname = 'finance_payment_status_enum'
        ) AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'finance'
              AND t.typname = 'finance_payment_status_enum'
              AND e.enumlabel = 'PENDING'
        ) THEN
            CREATE TYPE "finance"."finance_payment_status_enum_new" AS ENUM (
                'PENDING',
                'SUCCESS',
                'FAILED',
                'CANCELED'
            );

            ALTER TABLE "finance"."payments"
                ALTER COLUMN "status" TYPE "finance"."finance_payment_status_enum_new"
                USING (
                    CASE
                        WHEN "status"::text = 'INITIATED' THEN 'PENDING'
                        WHEN "status"::text = 'VERIFIED' THEN 'SUCCESS'
                        WHEN "status"::text = 'FAILED' THEN 'FAILED'
                        ELSE 'FAILED'
                    END
                )::"finance"."finance_payment_status_enum_new";

            ALTER TYPE "finance"."finance_payment_status_enum" RENAME TO "finance_payment_status_enum_old";
            ALTER TYPE "finance"."finance_payment_status_enum_new" RENAME TO "finance_payment_status_enum";
            DROP TYPE "finance"."finance_payment_status_enum_old";
        END IF;

        -- Add reference columns to payments
        ALTER TABLE "finance"."payments"
            ADD COLUMN IF NOT EXISTS "reference_type" "finance"."finance_payment_reference_type_enum",
            ADD COLUMN IF NOT EXISTS "reference_id" VARCHAR(128);

        CREATE INDEX IF NOT EXISTS "payments_reference_idx"
            ON "finance"."payments" ("reference_type", "reference_id");

        -- Create subscription purchases table
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'finance'
              AND table_name = 'subscription_purchases'
        ) THEN
            CREATE TABLE "finance"."subscription_purchases" (
                "id" UUID NOT NULL,
                "user_id" UUID NOT NULL,
                "plan_id" UUID NOT NULL,
                "status" "finance"."finance_subscription_purchase_status_enum" NOT NULL DEFAULT 'PENDING',
                "amount" INTEGER NOT NULL,
                "currency" VARCHAR(8) NOT NULL,
                "duration_months" INTEGER NOT NULL DEFAULT 1,
                "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "paid_at" TIMESTAMPTZ(6),
                "payment_id" UUID,
                CONSTRAINT "subscription_purchases_pkey" PRIMARY KEY ("id")
            );
        END IF;

        CREATE INDEX IF NOT EXISTS "subscription_purchases_user_created_idx"
            ON "finance"."subscription_purchases" ("user_id", "created_at");
        CREATE INDEX IF NOT EXISTS "subscription_purchases_plan_id_idx"
            ON "finance"."subscription_purchases" ("plan_id");
        CREATE INDEX IF NOT EXISTS "subscription_purchases_payment_id_idx"
            ON "finance"."subscription_purchases" ("payment_id");

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'subscription_purchases_user_id_fkey'
        ) THEN
            ALTER TABLE "finance"."subscription_purchases"
                ADD CONSTRAINT "subscription_purchases_user_id_fkey"
                FOREIGN KEY ("user_id") REFERENCES "core"."users"("id")
                ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'subscription_purchases_plan_id_fkey'
        ) THEN
            ALTER TABLE "finance"."subscription_purchases"
                ADD CONSTRAINT "subscription_purchases_plan_id_fkey"
                FOREIGN KEY ("plan_id") REFERENCES "finance"."subscription_plans"("id")
                ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'subscription_purchases_payment_id_fkey'
        ) THEN
            ALTER TABLE "finance"."subscription_purchases"
                ADD CONSTRAINT "subscription_purchases_payment_id_fkey"
                FOREIGN KEY ("payment_id") REFERENCES "finance"."payments"("id")
                ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
