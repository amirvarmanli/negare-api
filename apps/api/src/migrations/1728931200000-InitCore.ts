import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitCore1728931200000 implements MigrationInterface {
  name = 'InitCore1728931200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(
      `CREATE TYPE "public"."role_name_enum" AS ENUM('user', 'supplier', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."wallet_currency_enum" AS ENUM('IRR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."wallet_transaction_type_enum" AS ENUM('credit', 'debit')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."wallet_transaction_status_enum" AS ENUM('pending', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."wallet_transaction_ref_type_enum" AS ENUM('order', 'payout', 'adjustment')`,
    );

    await queryRunner.query(
      `CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "username" character varying NOT NULL,
        "email" character varying,
        "phone" character varying,
        "name" character varying,
        "bio" text,
        "city" character varying,
        "avatarUrl" character varying,
        "passwordHash" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_phone" UNIQUE ("phone")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "name" "public"."role_name_enum" NOT NULL,
        CONSTRAINT "UQ_roles_name" UNIQUE ("name")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "user_roles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        CONSTRAINT "UQ_user_roles_user_id_role_id" UNIQUE ("user_id", "role_id"),
        CONSTRAINT "FK_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_roles_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "wallets" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "balance" BIGINT NOT NULL DEFAULT 0,
        "currency" "public"."wallet_currency_enum" NOT NULL DEFAULT 'IRR',
        CONSTRAINT "UQ_wallets_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_wallets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "wallet_transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "wallet_id" uuid NOT NULL,
        "type" "public"."wallet_transaction_type_enum" NOT NULL,
        "status" "public"."wallet_transaction_status_enum" NOT NULL DEFAULT 'pending',
        "amount" BIGINT NOT NULL,
        "ref_type" "public"."wallet_transaction_ref_type_enum" NOT NULL,
        "ref_id" character varying,
        "description" text,
        CONSTRAINT "FK_wallet_transactions_wallet" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_transactions_wallet_id" ON "wallet_transactions" ("wallet_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_transactions_type" ON "wallet_transactions" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_transactions_ref_type" ON "wallet_transactions" ("ref_type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_wallet_transactions_ref_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_wallet_transactions_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_wallet_transactions_wallet_id"`,
    );
    await queryRunner.query(`DROP TABLE "wallet_transactions"`);
    await queryRunner.query(`DROP TABLE "wallets"`);
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "users"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."wallet_transaction_ref_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."wallet_transaction_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."wallet_transaction_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."wallet_currency_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."role_name_enum"`,
    );
  }
}
