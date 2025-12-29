-- Add donation purpose/reference values
ALTER TYPE "finance"."finance_payment_purpose_enum" ADD VALUE 'DONATION';
ALTER TYPE "finance"."finance_payment_reference_type_enum" ADD VALUE 'donation';

-- Create donation status enum
CREATE TYPE "finance"."finance_donation_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- Create donations table
CREATE TABLE "finance"."donations" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "amount" INTEGER NOT NULL,
    "status" "finance"."finance_donation_status_enum" NOT NULL,
    "gateway_track_id" VARCHAR(128),
    "reference_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "donations_user_id_created_at_idx" ON "finance"."donations"("user_id", "created_at");

-- Add foreign key
ALTER TABLE "finance"."donations" ADD CONSTRAINT "donations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
