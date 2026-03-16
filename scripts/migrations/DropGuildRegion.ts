import { MigrationInterface, QueryRunner } from "typeorm";

export class DropGuildRegion1699999999999 implements MigrationInterface {
	name = "DropGuildRegion1699999999999";

	public async up(queryRunner: QueryRunner): Promise<void> {
		const driver = queryRunner.connection.options.type;
		if (driver === "postgres") {
			await queryRunner.query(
				"DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guilds' AND column_name = 'region') THEN ALTER TABLE \"guilds\" DROP COLUMN \"region\"; END IF; END $$;",
			);
		} else {
			await queryRunner
				.query("ALTER TABLE guilds DROP COLUMN IF EXISTS region")
				.catch(async () => {
					try {
						await queryRunner.query(
							"ALTER TABLE guilds DROP COLUMN region",
						);
					} catch {}
				});
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		const driver = queryRunner.connection.options.type;
		if (driver === "postgres") {
			await queryRunner.query(
				'ALTER TABLE "guilds" ADD COLUMN "region" character varying',
			);
		} else {
			await queryRunner.query(
				"ALTER TABLE guilds ADD COLUMN region varchar(255) NULL",
			);
		}
	}
}
