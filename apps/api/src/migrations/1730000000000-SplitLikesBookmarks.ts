import { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitLikesBookmarks1730000000000 implements MigrationInterface {
  name = 'SplitLikesBookmarks1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasFavorites = await queryRunner.hasTable('content.favorites');

    if (hasFavorites) {
      await queryRunner.query(
        'ALTER TABLE "content"."favorites" RENAME TO "bookmarks"',
      );
      await queryRunner.query(
        'ALTER TABLE "content"."bookmarks" RENAME CONSTRAINT "PK_favorites_user_product" TO "PK_bookmarks_user_product"',
      );
      await queryRunner.query(
        'ALTER TABLE "content"."bookmarks" RENAME CONSTRAINT "FK_favorites_user" TO "FK_bookmarks_user"',
      );
      await queryRunner.query(
        'ALTER TABLE "content"."bookmarks" RENAME CONSTRAINT "FK_favorites_product" TO "FK_bookmarks_product"',
      );
    }

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "content"."likes" (
        "user_id" uuid NOT NULL,
        "product_id" bigint NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_likes_user_product" PRIMARY KEY ("user_id", "product_id"),
        CONSTRAINT "FK_likes_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_likes_product" FOREIGN KEY ("product_id") REFERENCES "content"."products"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_likes_product_id" ON "content"."likes" ("product_id")',
    );

    if (await queryRunner.hasTable('content.bookmarks')) {
      await queryRunner.query(
        `INSERT INTO "content"."likes" ("user_id", "product_id", "created_at")
         SELECT "user_id", "product_id", COALESCE("created_at", now())
         FROM "content"."bookmarks"
         ON CONFLICT DO NOTHING`,
      );

      await queryRunner.query(
        'DELETE FROM "content"."bookmarks"',
      );
    }

    await queryRunner.query(
      'UPDATE "content"."products" SET "likes_count" = 0',
    );
    await queryRunner.query(
      `UPDATE "content"."products" p
       SET "likes_count" = likes."count"
       FROM (
         SELECT "product_id", COUNT(*)::int AS "count"
         FROM "content"."likes"
         GROUP BY "product_id"
       ) likes
       WHERE p."id" = likes."product_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasBookmarks = await queryRunner.hasTable('content.bookmarks');

    if (hasBookmarks) {
      await queryRunner.query(
        `INSERT INTO "content"."bookmarks" ("user_id", "product_id", "created_at")
         SELECT "user_id", "product_id", "created_at"
         FROM "content"."likes"
         ON CONFLICT DO NOTHING`,
      );
    }

    await queryRunner.query(
      'DROP INDEX IF EXISTS "content"."IDX_likes_product_id"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "content"."likes"');

    if (hasBookmarks) {
      await queryRunner.query(
        'ALTER TABLE "content"."bookmarks" RENAME CONSTRAINT "PK_bookmarks_user_product" TO "PK_favorites_user_product"',
      );
      await queryRunner.query(
        'ALTER TABLE "content"."bookmarks" RENAME CONSTRAINT "FK_bookmarks_user" TO "FK_favorites_user"',
      );
      await queryRunner.query(
        'ALTER TABLE "content"."bookmarks" RENAME CONSTRAINT "FK_bookmarks_product" TO "FK_favorites_product"',
      );
      await queryRunner.query(
        'ALTER TABLE "content"."bookmarks" RENAME TO "favorites"',
      );
    }

    await queryRunner.query(
      'UPDATE "content"."products" SET "likes_count" = 0',
    );
    if (await queryRunner.hasTable('content.favorites')) {
      await queryRunner.query(
        `UPDATE "content"."products" p
         SET "likes_count" = fav."count"
         FROM (
           SELECT "product_id", COUNT(*)::int AS "count"
           FROM "content"."favorites"
           GROUP BY "product_id"
         ) fav
         WHERE p."id" = fav."product_id"`,
      );
    }
  }
}
