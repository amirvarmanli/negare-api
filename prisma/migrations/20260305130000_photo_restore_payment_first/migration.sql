-- Update order_requests to support fileUrl and make local file metadata optional
ALTER TABLE "public"."order_requests"
    ADD COLUMN "file_url" VARCHAR(1000) NOT NULL,
    ADD COLUMN "file_source" VARCHAR(64),
    ALTER COLUMN "file_kind" DROP NOT NULL,
    ALTER COLUMN "original_file_name" DROP NOT NULL,
    ALTER COLUMN "file_mime_type" DROP NOT NULL,
    ALTER COLUMN "file_size" DROP NOT NULL,
    ALTER COLUMN "storage_key" DROP NOT NULL;

-- Create purpose enum for order request payments
CREATE TYPE "public"."order_request_payment_purpose_enum" AS ENUM ('PHOTO_RESTORE');

-- Update payments for payment-first flow
ALTER TABLE "public"."order_request_payments"
    ADD COLUMN "purpose" "public"."order_request_payment_purpose_enum" NOT NULL DEFAULT 'PHOTO_RESTORE',
    ADD COLUMN "order_draft" JSONB,
    ALTER COLUMN "order_request_id" DROP NOT NULL,
    ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Ensure track_id is unique
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'order_request_payments_track_idx'
    ) THEN
        DROP INDEX "public"."order_request_payments_track_idx";
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "order_request_payments_track_id_key"
    ON "public"."order_request_payments"("track_id");

-- Update foreign key to set null on delete
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'order_request_payments_order_request_id_fkey'
    ) THEN
        ALTER TABLE "public"."order_request_payments"
            DROP CONSTRAINT "order_request_payments_order_request_id_fkey";
    END IF;
END $$;

ALTER TABLE "public"."order_request_payments"
    ADD CONSTRAINT "order_request_payments_order_request_id_fkey"
    FOREIGN KEY ("order_request_id") REFERENCES "public"."order_requests"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
