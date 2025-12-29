-- Create enums for order requests
CREATE TYPE "public"."order_request_messenger_enum" AS ENUM ('telegram', 'eitaa', 'ble');
CREATE TYPE "public"."order_request_file_kind_enum" AS ENUM ('IMAGE', 'ZIP');
CREATE TYPE "public"."order_request_payment_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELED');

-- Create order requests table
CREATE TABLE "public"."order_requests" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "messenger" "public"."order_request_messenger_enum" NOT NULL,
    "phone_number" VARCHAR(32) NOT NULL,
    "description" VARCHAR(2000),
    "image_count" INTEGER NOT NULL,
    "amount_toman" INTEGER NOT NULL,
    "file_kind" "public"."order_request_file_kind_enum" NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "file_mime_type" VARCHAR(128) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_requests_pkey" PRIMARY KEY ("id")
);

-- Create order request payments table
CREATE TABLE "public"."order_request_payments" (
    "id" UUID NOT NULL,
    "order_request_id" UUID NOT NULL,
    "gateway" VARCHAR(32) NOT NULL,
    "amount_toman" INTEGER NOT NULL,
    "status" "public"."order_request_payment_status_enum" NOT NULL,
    "track_id" VARCHAR(64),
    "transaction_id" VARCHAR(128),
    "redirect_url" VARCHAR(512),
    "result" INTEGER,
    "message" VARCHAR(512),
    "raw_request" JSONB,
    "raw_verify" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_request_payments_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "order_requests_created_at_idx" ON "public"."order_requests"("created_at");
CREATE UNIQUE INDEX "order_request_payments_order_request_id_key" ON "public"."order_request_payments"("order_request_id");
CREATE INDEX "order_request_payments_track_idx" ON "public"."order_request_payments"("track_id");

-- Add foreign key
ALTER TABLE "public"."order_request_payments" ADD CONSTRAINT "order_request_payments_order_request_id_fkey" FOREIGN KEY ("order_request_id") REFERENCES "public"."order_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
