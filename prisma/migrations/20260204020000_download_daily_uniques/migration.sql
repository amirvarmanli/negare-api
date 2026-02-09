-- Create daily unique download tracker for quota-safe duplicate handling
CREATE TABLE "finance"."download_daily_uniques" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "product_id" bigint NOT NULL,
    "date_key" varchar(10) NOT NULL,
    "created_at" timestamptz(6) NOT NULL DEFAULT now(),
    CONSTRAINT "download_daily_uniques_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "download_daily_uniques_user_id_product_id_date_key_key"
ON "finance"."download_daily_uniques" ("user_id", "product_id", "date_key");

CREATE INDEX "download_daily_uniques_user_id_date_key_idx"
ON "finance"."download_daily_uniques" ("user_id", "date_key");

ALTER TABLE "finance"."download_daily_uniques"
ADD CONSTRAINT "download_daily_uniques_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "finance"."download_daily_uniques"
ADD CONSTRAINT "download_daily_uniques_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
