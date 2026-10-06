import { MigrationInterface, QueryRunner } from "typeorm";

export class Soundboard1789247165699 implements MigrationInterface {
    name = "Soundboard1789247165699";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "soundboard_sound" ("id" bigint NOT NULL, "name" character varying NOT NULL, "volume" integer NOT NULL, "emoji_id" bigint, "emoji_name" character varying, "guild_id" bigint, "user_id" bigint, CONSTRAINT "PK_f4afcf47a197afa1027ffd2870d" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `ALTER TABLE "soundboard_sound" ADD CONSTRAINT "FK_b5f3a6031f93281fa6cb11122a1" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "soundboard_sound" ADD CONSTRAINT "FK_164f0c5f18adcd802a643ee7744" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "soundboard_sound" DROP CONSTRAINT "FK_164f0c5f18adcd802a643ee7744"`);
        await queryRunner.query(`ALTER TABLE "soundboard_sound" DROP CONSTRAINT "FK_b5f3a6031f93281fa6cb11122a1"`);
        await queryRunner.query(`DROP TABLE "soundboard_sound"`);
    }
}
