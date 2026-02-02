CREATE TABLE "finance"."download_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_free" BOOLEAN NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "request_id" VARCHAR(128),
    CONSTRAINT "download_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "download_events_user_id_occurred_at_idx" ON "finance"."download_events" ("user_id", "occurred_at");
CREATE INDEX "download_events_user_id_is_free_occurred_at_idx" ON "finance"."download_events" ("user_id", "is_free", "occurred_at");
CREATE INDEX "download_events_product_id_occurred_at_idx" ON "finance"."download_events" ("product_id", "occurred_at");

ALTER TABLE "finance"."download_events"
ADD CONSTRAINT "download_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance"."download_events"
ADD CONSTRAINT "download_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
