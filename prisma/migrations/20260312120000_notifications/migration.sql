-- Notifications core tables + enums

CREATE TYPE "core"."notification_type_enum" AS ENUM (
    'ADMIN_BROADCAST',
    'FOLLOWED_YOU',
    'PURCHASED_YOUR_PRODUCT',
    'WALLET_CREDITED',
    'NEW_PRODUCT_FROM_FOLLOWED'
);

CREATE TYPE "core"."notification_status_enum" AS ENUM (
    'UNREAD',
    'READ',
    'ARCHIVED'
);

CREATE TYPE "core"."notification_target_group_enum" AS ENUM (
    'ALL_USERS',
    'SUPPLIERS_ONLY',
    'USERS_ONLY'
);

CREATE TABLE "core"."notifications" (
    "id" UUID NOT NULL,
    "type" "core"."notification_type_enum" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" VARCHAR(500),
    "data" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_type_idx" ON "core"."notifications"("type");
CREATE INDEX "notifications_createdAt_idx" ON "core"."notifications"("createdAt");

CREATE TABLE "core"."user_notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "status" "core"."notification_status_enum" NOT NULL DEFAULT 'UNREAD',
    "readAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMPTZ(6),
    "dedupeKey" VARCHAR(200),

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_notifications_userId_dedupeKey_key"
    ON "core"."user_notifications"("userId", "dedupeKey");

CREATE INDEX "user_notifications_user_status_created_idx"
    ON "core"."user_notifications"("userId", "status", "createdAt");

CREATE INDEX "user_notifications_user_created_idx"
    ON "core"."user_notifications"("userId", "createdAt");

ALTER TABLE "core"."notifications"
    ADD CONSTRAINT "notifications_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "core"."users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "core"."user_notifications"
    ADD CONSTRAINT "user_notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "core"."users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core"."user_notifications"
    ADD CONSTRAINT "user_notifications_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "core"."notifications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
