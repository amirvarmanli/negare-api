-- Add entity link metadata to notifications and soft-delete to user notifications
ALTER TABLE "core"."notifications"
  ADD COLUMN "entityType" VARCHAR(50),
  ADD COLUMN "entitySlug" VARCHAR(255),
  ADD COLUMN "entityId" VARCHAR(255),
  ADD COLUMN "href" VARCHAR(500);

ALTER TABLE "core"."user_notifications"
  ADD COLUMN "deletedAt" TIMESTAMPTZ(6);
