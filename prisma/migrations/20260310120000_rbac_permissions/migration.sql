-- Add role column to users
ALTER TABLE "core"."users"
    ADD COLUMN "role" "core"."role_name_enum" NOT NULL DEFAULT 'user';

-- Backfill role from existing user_roles (admin > supplier > user)
UPDATE "core"."users" AS u
SET "role" = 'admin'
WHERE EXISTS (
    SELECT 1
    FROM "core"."user_roles" AS ur
    JOIN "core"."roles" AS r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
      AND r.name = 'admin'
);

UPDATE "core"."users" AS u
SET "role" = 'supplier'
WHERE u."role" <> 'admin'
  AND EXISTS (
    SELECT 1
    FROM "core"."user_roles" AS ur
    JOIN "core"."roles" AS r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
      AND r.name = 'supplier'
);

-- Create permissions catalog table
CREATE TABLE "core"."permissions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "group" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- Create per-user permission overrides
CREATE TABLE "core"."user_permissions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- Uniques
CREATE UNIQUE INDEX "permissions_key_key" ON "core"."permissions"("key");
CREATE UNIQUE INDEX "user_permissions_userId_permissionId_key"
    ON "core"."user_permissions"("userId", "permissionId");

-- Foreign keys
ALTER TABLE "core"."user_permissions"
    ADD CONSTRAINT "user_permissions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "core"."users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core"."user_permissions"
    ADD CONSTRAINT "user_permissions_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "core"."permissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
