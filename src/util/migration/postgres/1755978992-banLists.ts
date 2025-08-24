import { MigrationInterface, QueryRunner } from "typeorm";

export class BanLists1755978992 implements MigrationInterface {
	name = "BanLists1755978992";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "ban_lists" (
				"id" character varying NOT NULL,
				"name" character varying NOT NULL,
				"description" text,
				"creator_id" character varying NOT NULL,
				"creator_type" character varying NOT NULL CHECK ("creator_type" IN ('user', 'channel', 'role', 'group', 'guild')),
				"is_public" boolean NOT NULL DEFAULT false,
				"created_at" TIMESTAMP NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP NOT NULL DEFAULT now(),
				CONSTRAINT "PK_ban_lists" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			CREATE TABLE "ban_list_entries" (
				"id" character varying NOT NULL,
				"ban_list_id" character varying NOT NULL,
				"banned_user_id" character varying NOT NULL,
				"reason" text,
				"created_at" TIMESTAMP NOT NULL DEFAULT now(),
				CONSTRAINT "PK_ban_list_entries" PRIMARY KEY ("id"),
				CONSTRAINT "FK_ban_list_entries_ban_list" FOREIGN KEY ("ban_list_id") REFERENCES "ban_lists"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_ban_list_entries_user" FOREIGN KEY ("banned_user_id") REFERENCES "users"("id") ON DELETE CASCADE
			)
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX "IDX_ban_list_entries_unique" ON "ban_list_entries" ("ban_list_id", "banned_user_id")
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_ban_list_entries_banned_user" ON "ban_list_entries" ("banned_user_id")
		`);

		await queryRunner.query(`
			CREATE TABLE "ban_list_subscriptions" (
				"id" character varying NOT NULL,
				"subscriber_id" character varying NOT NULL,
				"subscriber_type" character varying NOT NULL CHECK ("subscriber_type" IN ('user', 'channel', 'guild')),
				"ban_list_id" character varying NOT NULL,
				"created_at" TIMESTAMP NOT NULL DEFAULT now(),
				CONSTRAINT "PK_ban_list_subscriptions" PRIMARY KEY ("id"),
				CONSTRAINT "FK_ban_list_subscriptions_ban_list" FOREIGN KEY ("ban_list_id") REFERENCES "ban_lists"("id") ON DELETE CASCADE
			)
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX "IDX_ban_list_subscriptions_unique" ON "ban_list_subscriptions" ("subscriber_id", "subscriber_type", "ban_list_id")
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_ban_list_subscriptions_subscriber" ON "ban_list_subscriptions" ("subscriber_id", "subscriber_type")
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_ban_list_subscriptions_ban_list" ON "ban_list_subscriptions" ("ban_list_id")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX "IDX_ban_list_subscriptions_ban_list"`,
		);
		await queryRunner.query(
			`DROP INDEX "IDX_ban_list_subscriptions_subscriber"`,
		);
		await queryRunner.query(
			`DROP INDEX "IDX_ban_list_subscriptions_unique"`,
		);
		await queryRunner.query(`DROP TABLE "ban_list_subscriptions"`);
		await queryRunner.query(
			`DROP INDEX "IDX_ban_list_entries_banned_user"`,
		);
		await queryRunner.query(`DROP INDEX "IDX_ban_list_entries_unique"`);
		await queryRunner.query(`DROP TABLE "ban_list_entries"`);
		await queryRunner.query(`DROP TABLE "ban_lists"`);
	}
}
