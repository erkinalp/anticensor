import { MigrationInterface, QueryRunner } from "typeorm";

export class Runningpolls1779327779416 implements MigrationInterface {
    name = "Runningpolls1779327779416";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "running_polls" ("id" character varying NOT NULL, "closes" TIMESTAMP NOT NULL, "message_id" character varying, CONSTRAINT "PK_f8ff0419d57aac9df4517cbbc52" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `ALTER TABLE "running_polls" ADD CONSTRAINT "FK_c4975ee9f27b4a7139b7456a6a8" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "running_polls" DROP CONSTRAINT "FK_c4975ee9f27b4a7139b7456a6a8"`);
        await queryRunner.query(`DROP TABLE "running_polls"`);
    }
}
