import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogProductFiles1730200000000 implements MigrationInterface {
  name = 'CatalogProductFiles1730200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "content"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "content"."product_files" (
        "id" BIGSERIAL PRIMARY KEY,
        "storage_key" character varying NOT NULL,
        "original_name" character varying,
        "size" BIGINT,
        "mime_type" character varying,
        "meta" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      'ALTER TABLE "content"."products" ADD COLUMN IF NOT EXISTS "file_id" BIGINT',
    );

    await queryRunner.query(
      'ALTER TABLE "content"."products" ADD CONSTRAINT "FK_products_file" FOREIGN KEY ("file_id") REFERENCES "content"."product_files"("id") ON DELETE SET NULL',
    );

    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_products_file_id" ON "content"."products" ("file_id") WHERE "file_id" IS NOT NULL',
    );

    await queryRunner.query(
      'ALTER TABLE "content"."product_assets" DROP COLUMN IF EXISTS "kind"',
    );
    await queryRunner.query(
      'ALTER TABLE "content"."product_assets" DROP COLUMN IF EXISTS "filesize"',
    );
    await queryRunner.query(
      'ALTER TABLE "content"."product_assets" ADD COLUMN IF NOT EXISTS "alt" character varying',
    );
    await queryRunner.query(
      'ALTER TABLE "content"."product_assets" ADD COLUMN IF NOT EXISTS "order" integer NOT NULL DEFAULT 0',
    );

    await queryRunner.query(
      'DROP TYPE IF EXISTS "content"."asset_kind_enum"',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_products_active_published" ON "content"."products" ("active", "publishedAt" DESC)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_products_active_published"',
    );

    await queryRunner.query(
      'ALTER TABLE "content"."product_assets" DROP COLUMN IF EXISTS "order"',
    );
    await queryRunner.query(
      'ALTER TABLE "content"."product_assets" DROP COLUMN IF EXISTS "alt"',
    );

    await queryRunner.query(
      'CREATE TYPE "content"."asset_kind_enum" AS ENUM (\'SOURCE\', \'PREVIEW\')',
    );
    await queryRunner.query(
      'ALTER TABLE "content"."product_assets" ADD COLUMN "kind" "content"."asset_kind_enum" NOT NULL DEFAULT \'PREVIEW\'',
    );
    await queryRunner.query(
      'ALTER TABLE "content"."product_assets" ADD COLUMN "filesize" BIGINT',
    );

    await queryRunner.query(
      'ALTER TABLE "content"."products" DROP CONSTRAINT IF EXISTS "FK_products_file"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_products_file_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "content"."products" DROP COLUMN IF EXISTS "file_id"',
    );

    await queryRunner.query('DROP TABLE IF EXISTS "content"."product_files"');
  }
}
