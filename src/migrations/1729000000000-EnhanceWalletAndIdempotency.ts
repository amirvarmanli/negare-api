import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceWalletAndIdempotency1729000000000
  implements MigrationInterface
{
  name = 'EnhanceWalletAndIdempotency1729000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "balance" BIGINT NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "idempotency_key" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "metadata" jsonb`,
    );

    await queryRunner.query(
      `UPDATE "wallet_transactions" SET "user_id" = wallet."user_id"
       FROM "wallets" wallet
       WHERE wallet.id = "wallet_transactions"."wallet_id" AND "wallet_transactions"."user_id" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "wallet_transactions" SET "idempotency_key" = uuid_generate_v4()
       WHERE "idempotency_key" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" ALTER COLUMN "user_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" ALTER COLUMN "idempotency_key" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" ADD CONSTRAINT "FK_wallet_transactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" ADD CONSTRAINT "UQ_wallet_transactions_idempotency_key" UNIQUE ("idempotency_key")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_wallet_tx_user_id" ON "wallet_transactions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_wallet_tx_created_at" ON "wallet_transactions" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_wallet_tx_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_wallet_tx_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" DROP CONSTRAINT IF EXISTS "UQ_wallet_transactions_idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" DROP CONSTRAINT IF EXISTS "FK_wallet_transactions_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" DROP COLUMN IF EXISTS "metadata"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" DROP COLUMN IF EXISTS "idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" DROP COLUMN IF EXISTS "user_id"`,
    );
  }
}
