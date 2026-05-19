import { MigrationInterface, QueryRunner } from "typeorm";

export class MessageSourceChannel1763660098000 implements MigrationInterface {
    name = "MessageSourceChannel1763660098000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE messages ADD source_channel_id varchar NULL");
        await queryRunner.query("CREATE INDEX IDX_messages_source_channel_id ON messages (source_channel_id)");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP INDEX IDX_messages_source_channel_id");
        await queryRunner.query("ALTER TABLE messages DROP COLUMN source_channel_id");
    }
}
