import { MigrationInterface, QueryRunner } from "typeorm";

export class BanLists1755978992 implements MigrationInterface {
	name = "BanLists1755978992";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE \`ban_lists\` (
				\`id\` varchar(255) NOT NULL,
				\`name\` varchar(255) NOT NULL,
				\`description\` text,
				\`creator_id\` varchar(255) NOT NULL,
				\`creator_type\` enum('user', 'channel', 'role', 'group', 'guild') NOT NULL,
				\`is_public\` tinyint NOT NULL DEFAULT 0,
				\`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
				\`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
				PRIMARY KEY (\`id\`)
			) ENGINE=InnoDB
		`);

		await queryRunner.query(`
			CREATE TABLE \`ban_list_entries\` (
				\`id\` varchar(255) NOT NULL,
				\`ban_list_id\` varchar(255) NOT NULL,
				\`banned_user_id\` varchar(255) NOT NULL,
				\`reason\` text,
				\`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
				PRIMARY KEY (\`id\`),
				UNIQUE KEY \`IDX_ban_list_entries_unique\` (\`ban_list_id\`, \`banned_user_id\`),
				KEY \`IDX_ban_list_entries_banned_user\` (\`banned_user_id\`),
				CONSTRAINT \`FK_ban_list_entries_ban_list\` FOREIGN KEY (\`ban_list_id\`) REFERENCES \`ban_lists\` (\`id\`) ON DELETE CASCADE,
				CONSTRAINT \`FK_ban_list_entries_user\` FOREIGN KEY (\`banned_user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
			) ENGINE=InnoDB
		`);

		await queryRunner.query(`
			CREATE TABLE \`ban_list_subscriptions\` (
				\`id\` varchar(255) NOT NULL,
				\`subscriber_id\` varchar(255) NOT NULL,
				\`subscriber_type\` enum('user', 'channel', 'guild') NOT NULL,
				\`ban_list_id\` varchar(255) NOT NULL,
				\`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
				PRIMARY KEY (\`id\`),
				UNIQUE KEY \`IDX_ban_list_subscriptions_unique\` (\`subscriber_id\`, \`subscriber_type\`, \`ban_list_id\`),
				KEY \`IDX_ban_list_subscriptions_subscriber\` (\`subscriber_id\`, \`subscriber_type\`),
				KEY \`IDX_ban_list_subscriptions_ban_list\` (\`ban_list_id\`),
				CONSTRAINT \`FK_ban_list_subscriptions_ban_list\` FOREIGN KEY (\`ban_list_id\`) REFERENCES \`ban_lists\` (\`id\`) ON DELETE CASCADE
			) ENGINE=InnoDB
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE \`ban_list_subscriptions\``);
		await queryRunner.query(`DROP TABLE \`ban_list_entries\``);
		await queryRunner.query(`DROP TABLE \`ban_lists\``);
	}
}
