import { MigrationInterface, QueryRunner } from "typeorm";

export class MessageTimestampIndex1785262368845 implements MigrationInterface {
    name = "MessageTimestampIndex1785262368845";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_f2113da562ea5bb1ddff44ff60" ON "messages" ("timestamp") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f2113da562ea5bb1ddff44ff60"`);
    }
}
