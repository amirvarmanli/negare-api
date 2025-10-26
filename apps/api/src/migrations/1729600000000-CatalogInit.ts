import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogInit1729600000000 implements MigrationInterface {
  name = 'CatalogInit1729600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "content"`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "analytics"`);

    await queryRunner.query(
      `CREATE TYPE "content"."pricing_type_enum" AS ENUM('FREE', 'SUBSCRIPTION', 'PAID', 'PAID_OR_SUBSCRIPTION')`,
    );
    await queryRunner.query(
      `CREATE TYPE "content"."asset_kind_enum" AS ENUM('SOURCE', 'PREVIEW')`,
    );

    await queryRunner.query(
      `CREATE TABLE "content"."categories" (
        "id" BIGSERIAL PRIMARY KEY,
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "parent_id" BIGINT,
        CONSTRAINT "UQ_categories_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_categories_parent" FOREIGN KEY ("parent_id") REFERENCES "content"."categories"("id") ON DELETE SET NULL
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "content"."tags" (
        "id" BIGSERIAL PRIMARY KEY,
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        CONSTRAINT "UQ_tags_name" UNIQUE ("name"),
        CONSTRAINT "UQ_tags_slug" UNIQUE ("slug")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "content"."products" (
        "id" BIGSERIAL PRIMARY KEY,
        "slug" character varying NOT NULL,
        "title" character varying NOT NULL,
        "description" text,
        "coverUrl" character varying,
        "pricingType" "content"."pricing_type_enum" NOT NULL,
        "price" NUMERIC(12, 2),
        "active" boolean NOT NULL DEFAULT true,
        "publishedAt" TIMESTAMPTZ,
        "viewsCount" integer NOT NULL DEFAULT 0,
        "downloadsCount" integer NOT NULL DEFAULT 0,
        "likesCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_products_slug" UNIQUE ("slug")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "content"."product_assets" (
        "id" BIGSERIAL PRIMARY KEY,
        "product_id" BIGINT NOT NULL,
        "kind" "content"."asset_kind_enum" NOT NULL,
        "url" character varying NOT NULL,
        "filesize" BIGINT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_product_assets_product" FOREIGN KEY ("product_id") REFERENCES "content"."products"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "content"."product_suppliers" (
        "product_id" BIGINT NOT NULL,
        "user_id" uuid NOT NULL,
        CONSTRAINT "PK_product_suppliers" PRIMARY KEY ("product_id", "user_id"),
        CONSTRAINT "FK_product_suppliers_product" FOREIGN KEY ("product_id") REFERENCES "content"."products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_suppliers_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "content"."product_categories" (
        "product_id" BIGINT NOT NULL,
        "category_id" BIGINT NOT NULL,
        CONSTRAINT "PK_product_categories" PRIMARY KEY ("product_id", "category_id"),
        CONSTRAINT "FK_product_categories_product" FOREIGN KEY ("product_id") REFERENCES "content"."products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_categories_category" FOREIGN KEY ("category_id") REFERENCES "content"."categories"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "content"."product_tags" (
        "product_id" BIGINT NOT NULL,
        "tag_id" BIGINT NOT NULL,
        CONSTRAINT "PK_product_tags" PRIMARY KEY ("product_id", "tag_id"),
        CONSTRAINT "FK_product_tags_product" FOREIGN KEY ("product_id") REFERENCES "content"."products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "content"."tags"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "content"."favorites" (
        "user_id" uuid NOT NULL,
        "product_id" BIGINT NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_favorites_user_product" PRIMARY KEY ("user_id", "product_id"),
        CONSTRAINT "FK_favorites_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_favorites_product" FOREIGN KEY ("product_id") REFERENCES "content"."products"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "analytics"."product_views" (
        "id" BIGSERIAL PRIMARY KEY,
        "product_id" BIGINT NOT NULL,
        "user_id" uuid,
        "ip" character varying,
        "ua" character varying,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_product_views_product" FOREIGN KEY ("product_id") REFERENCES "content"."products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_views_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "analytics"."product_downloads" (
        "id" BIGSERIAL PRIMARY KEY,
        "product_id" BIGINT NOT NULL,
        "user_id" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_product_downloads_product" FOREIGN KEY ("product_id") REFERENCES "content"."products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_downloads_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_products_active_published" ON "content"."products" ("active", "publishedAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_pricing_type" ON "content"."products" ("pricingType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_downloads_user_date" ON "analytics"."product_downloads" ("user_id", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_downloads_product" ON "analytics"."product_downloads" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_views_product" ON "analytics"."product_views" ("product_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "analytics"."IDX_product_views_product"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "analytics"."IDX_product_downloads_product"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "analytics"."IDX_product_downloads_user_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "content"."IDX_products_pricing_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "content"."IDX_products_active_published"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "analytics"."product_downloads"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics"."product_views"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "content"."favorites"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "content"."product_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "content"."product_categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "content"."product_suppliers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "content"."product_assets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "content"."products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "content"."tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "content"."categories"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "content"."asset_kind_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "content"."pricing_type_enum"`,
    );

    await queryRunner.query(`DROP SCHEMA IF EXISTS "analytics" CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "content" CASCADE`);
  }
}
