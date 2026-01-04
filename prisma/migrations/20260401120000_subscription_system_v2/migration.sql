-- CreateTable
CREATE TABLE "finance"."subscription_plans_v2" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "price" INTEGER NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "daily_subscription_download_limit" INTEGER NOT NULL,
    "daily_free_download_limit_with_subscription" INTEGER NOT NULL,
    "description" VARCHAR(2000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "discount_percent" INTEGER,
    "discount_quota" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscription_plans_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."user_subscriptions_v2" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "plan_title" VARCHAR(255) NOT NULL,
    "price" INTEGER NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "daily_subscription_download_limit" INTEGER NOT NULL,
    "daily_free_download_limit_with_subscription" INTEGER NOT NULL,
    "discount_percent" INTEGER,
    "discount_remaining" INTEGER NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "finance"."finance_subscription_status_enum" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_subscriptions_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_download_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "supplier_id" UUID NOT NULL,
    "download_type" VARCHAR(20) NOT NULL,
    "subscription_id" UUID,
    "date_key" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_download_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_discount_usages" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ(6),

    CONSTRAINT "subscription_discount_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_settlements" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "price" INTEGER NOT NULL,
    "total_downloads" INTEGER NOT NULL,
    "platform_amount" INTEGER NOT NULL,
    "supplier_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_settlement_suppliers" (
    "id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "download_count" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_settlement_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_plans_v2_is_active_idx" ON "finance"."subscription_plans_v2"("is_active");

-- CreateIndex
CREATE INDEX "user_subscriptions_v2_user_id_status_idx" ON "finance"."user_subscriptions_v2"("user_id", "status");

-- CreateIndex
CREATE INDEX "user_subscriptions_v2_end_at_status_idx" ON "finance"."user_subscriptions_v2"("end_at", "status");

-- CreateIndex
CREATE INDEX "subscription_download_logs_user_id_date_key_download_type_idx" ON "finance"."subscription_download_logs"("user_id", "date_key", "download_type");

-- CreateIndex
CREATE INDEX "subscription_download_logs_subscription_id_created_at_idx" ON "finance"."subscription_download_logs"("subscription_id", "created_at");

-- CreateIndex
CREATE INDEX "subscription_download_logs_supplier_id_created_at_idx" ON "finance"."subscription_download_logs"("supplier_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_discount_usages_order_id_key" ON "finance"."subscription_discount_usages"("order_id");

-- CreateIndex
CREATE INDEX "subscription_discount_usages_subscription_id_idx" ON "finance"."subscription_discount_usages"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_settlements_subscription_id_key" ON "finance"."subscription_settlements"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_settlements_user_id_created_at_idx" ON "finance"."subscription_settlements"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_settlement_suppliers_settlement_id_supplier_id_key" ON "finance"."subscription_settlement_suppliers"("settlement_id", "supplier_id");

-- CreateIndex
CREATE INDEX "subscription_settlement_suppliers_supplier_id_idx" ON "finance"."subscription_settlement_suppliers"("supplier_id");

-- AddForeignKey
ALTER TABLE "finance"."user_subscriptions_v2" ADD CONSTRAINT "user_subscriptions_v2_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "finance"."subscription_plans_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."user_subscriptions_v2" ADD CONSTRAINT "user_subscriptions_v2_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_download_logs" ADD CONSTRAINT "subscription_download_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_download_logs" ADD CONSTRAINT "subscription_download_logs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_download_logs" ADD CONSTRAINT "subscription_download_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_download_logs" ADD CONSTRAINT "subscription_download_logs_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "finance"."user_subscriptions_v2"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_discount_usages" ADD CONSTRAINT "subscription_discount_usages_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "finance"."user_subscriptions_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_discount_usages" ADD CONSTRAINT "subscription_discount_usages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "finance"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_discount_usages" ADD CONSTRAINT "subscription_discount_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_settlements" ADD CONSTRAINT "subscription_settlements_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "finance"."user_subscriptions_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_settlements" ADD CONSTRAINT "subscription_settlements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "finance"."subscription_plans_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_settlements" ADD CONSTRAINT "subscription_settlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_settlement_suppliers" ADD CONSTRAINT "subscription_settlement_suppliers_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "finance"."subscription_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_settlement_suppliers" ADD CONSTRAINT "subscription_settlement_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
