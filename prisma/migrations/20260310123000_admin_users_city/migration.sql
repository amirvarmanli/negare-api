-- Add admin-user name fields + city relation
ALTER TABLE "core"."users"
    ADD COLUMN "firstName" VARCHAR(120),
    ADD COLUMN "lastName" VARCHAR(120),
    ADD COLUMN "cityId" UUID;

-- Create cities table
CREATE TABLE "core"."cities" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "province" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cities_name_idx" ON "core"."cities"("name");

ALTER TABLE "core"."users"
    ADD CONSTRAINT "users_cityId_fkey"
    FOREIGN KEY ("cityId") REFERENCES "core"."cities"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
