import { MigrationInterface, QueryRunner } from "typeorm";

export class DoublyLinkedReplies1755848356 implements MigrationInterface {
	name = "DoublyLinkedReplies1755848356";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query("ALTER TABLE messages ADD reply_ids text NULL");
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query("ALTER TABLE messages DROP COLUMN reply_ids");
	}
}
