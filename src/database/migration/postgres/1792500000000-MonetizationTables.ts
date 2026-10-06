import { MigrationInterface, QueryRunner } from "typeorm";

// Creates the tables and message columns for the anticensor monetization
// feature set (SKUs, entitlements, subscriptions, guild subscription tiers,
// guild member subscriptions) which previously only existed when booting
// with DB_SYNC. Generated from the entities via TypeORM synchronize.
export class MonetizationTables1792500000000 implements MigrationInterface {
    name = "MonetizationTables1792500000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Every statement is guarded: DB_SYNC-era deployments (the exact target
        // of this migration) already have these tables/columns, so an unguarded
        // CREATE/ADD would abort the migration on every boot.
        await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "role_subscription_data" jsonb, ADD COLUMN IF NOT EXISTS "sku_id" character varying`);
        // align consent tables' id/user_id columns with the int8 primary key convention
        await queryRunner.query(`ALTER TABLE user_consents ALTER COLUMN id TYPE bigint USING id::bigint`);
        await queryRunner.query(`ALTER TABLE user_consents ALTER COLUMN user_id TYPE bigint USING user_id::bigint`);
        await queryRunner.query(`ALTER TABLE consent_grants ALTER COLUMN id TYPE bigint USING id::bigint`);
        await queryRunner.query(`DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_consents_user_id') THEN
                    ALTER TABLE "user_consents" ADD CONSTRAINT "FK_user_consents_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
                END IF;
            END $$;`);
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "skus" ("id" bigint NOT NULL, "application_id" bigint NOT NULL, "type" integer NOT NULL, "name" character varying NOT NULL, "slug" character varying, "flags" integer NOT NULL DEFAULT 0, "summary" character varying, "description" character varying, "access_type" integer NOT NULL DEFAULT 1, "dependent_sku_id" character varying, "features" jsonb, "release_date" character varying, "premium" boolean NOT NULL DEFAULT false, "legal_notice" character varying, "price" jsonb, "price_tier" integer, "show_age_gate" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_334d59b0b01e5f2193966266e27" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "entitlements" ("id" bigint NOT NULL, "sku_id" bigint NOT NULL, "application_id" bigint NOT NULL, "user_id" bigint, "guild_id" bigint, "type" integer NOT NULL, "deleted" boolean NOT NULL DEFAULT false, "starts_at" TIMESTAMP, "ends_at" TIMESTAMP, "consumed" boolean NOT NULL DEFAULT false, "subscription_id" character varying, "promotion_id" character varying, "gift_code_flags" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_6a45cb6f5747d49365a879bffde" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "subscriptions" ("id" bigint NOT NULL, "user_id" bigint NOT NULL, "guild_id" bigint, "sku_ids" character varying[] NOT NULL, "entitlement_ids" character varying[] NOT NULL DEFAULT '{}', "renewal_sku_ids" character varying[], "current_period_start" TIMESTAMP NOT NULL, "current_period_end" TIMESTAMP NOT NULL, "status" integer NOT NULL DEFAULT 0, "canceled_at" TIMESTAMP, "country" character varying, "payment_gateway" character varying, "payment_gateway_subscription_id" character varying, "currency" character varying, "price" integer, CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "guild_subscription_tiers" ("id" bigint NOT NULL, "guild_id" bigint NOT NULL, "name" character varying NOT NULL, "description" character varying, "image" character varying, "position" integer NOT NULL, "price" jsonb NOT NULL, "role_ids" character varying[] NOT NULL DEFAULT '{}', "channel_ids" character varying[] NOT NULL DEFAULT '{}', "published" boolean NOT NULL DEFAULT true, "archived" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_dcf1103f4aa4b1f72891a7ea3fa" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "guild_member_subscriptions" ("id" bigint NOT NULL, "guild_id" bigint NOT NULL, "user_id" character varying NOT NULL, "tier_id" bigint NOT NULL, "current_period_start" TIMESTAMP WITH TIME ZONE NOT NULL, "current_period_end" TIMESTAMP WITH TIME ZONE NOT NULL, "status" integer NOT NULL DEFAULT 0, "ended_at" TIMESTAMP, CONSTRAINT "PK_ad5bc75b6509d7564bd7bc35139" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_c310e192ddf265117ff35afcfc1') THEN ALTER TABLE "skus" ADD CONSTRAINT "FK_c310e192ddf265117ff35afcfc1" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_4e24408e83a223fb1985d2778b3') THEN ALTER TABLE "entitlements" ADD CONSTRAINT "FK_4e24408e83a223fb1985d2778b3" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_5e76718d3e046887c486700aaae') THEN ALTER TABLE "entitlements" ADD CONSTRAINT "FK_5e76718d3e046887c486700aaae" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_30d2208c43f245217c03cb7ce31') THEN ALTER TABLE "entitlements" ADD CONSTRAINT "FK_30d2208c43f245217c03cb7ce31" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_5d6a05d15081531bfa691cd2ee7') THEN ALTER TABLE "entitlements" ADD CONSTRAINT "FK_5d6a05d15081531bfa691cd2ee7" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_d0a95ef8a28188364c546eb65c1') THEN ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_d0a95ef8a28188364c546eb65c1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_c7234ba9e8d3b3d0f1dfcf007c1') THEN ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_c7234ba9e8d3b3d0f1dfcf007c1" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_e45d457d3096e081ee65757cdd2') THEN ALTER TABLE "guild_subscription_tiers" ADD CONSTRAINT "FK_e45d457d3096e081ee65757cdd2" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_13753dcc34bce11eccf06dcd040') THEN ALTER TABLE "guild_member_subscriptions" ADD CONSTRAINT "FK_13753dcc34bce11eccf06dcd040" FOREIGN KEY ("tier_id") REFERENCES "guild_subscription_tiers"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_16e1a9a294fd35230a6b8f87414') THEN ALTER TABLE "guild_member_subscriptions" ADD CONSTRAINT "FK_16e1a9a294fd35230a6b8f87414" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$;`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "guild_member_subscriptions" DROP CONSTRAINT "FK_16e1a9a294fd35230a6b8f87414"`);
        await queryRunner.query(`ALTER TABLE "guild_member_subscriptions" DROP CONSTRAINT "FK_13753dcc34bce11eccf06dcd040"`);
        await queryRunner.query(`ALTER TABLE "guild_subscription_tiers" DROP CONSTRAINT "FK_e45d457d3096e081ee65757cdd2"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_c7234ba9e8d3b3d0f1dfcf007c1"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_d0a95ef8a28188364c546eb65c1"`);
        await queryRunner.query(`ALTER TABLE "entitlements" DROP CONSTRAINT "FK_5d6a05d15081531bfa691cd2ee7"`);
        await queryRunner.query(`ALTER TABLE "entitlements" DROP CONSTRAINT "FK_30d2208c43f245217c03cb7ce31"`);
        await queryRunner.query(`ALTER TABLE "entitlements" DROP CONSTRAINT "FK_5e76718d3e046887c486700aaae"`);
        await queryRunner.query(`ALTER TABLE "entitlements" DROP CONSTRAINT "FK_4e24408e83a223fb1985d2778b3"`);
        await queryRunner.query(`ALTER TABLE "skus" DROP CONSTRAINT "FK_c310e192ddf265117ff35afcfc1"`);
        await queryRunner.query(`DROP TABLE "guild_member_subscriptions"`);
        await queryRunner.query(`DROP TABLE "guild_subscription_tiers"`);
        await queryRunner.query(`DROP TABLE "subscriptions"`);
        await queryRunner.query(`DROP TABLE "entitlements"`);
        await queryRunner.query(`DROP TABLE "skus"`);
        await queryRunner.query(`ALTER TABLE messages DROP COLUMN "sku_id", DROP COLUMN "role_subscription_data"`);
        await queryRunner.query(`ALTER TABLE "user_consents" DROP CONSTRAINT "FK_user_consents_user_id"`);
        await queryRunner.query(`ALTER TABLE consent_grants ALTER COLUMN id TYPE character varying USING id::character varying`);
        await queryRunner.query(`ALTER TABLE user_consents ALTER COLUMN user_id TYPE character varying USING user_id::character varying`);
        await queryRunner.query(`ALTER TABLE user_consents ALTER COLUMN id TYPE character varying USING id::character varying`);
    }
}
