import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConnectionPrivacyFields1755804210000
	implements MigrationInterface
{
	name = "AddConnectionPrivacyFields1755804210000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			"ALTER TABLE connected_accounts ADD COLUMN consent_given_at timestamp DEFAULT NULL;",
		);
		await queryRunner.query(
			"ALTER TABLE connected_accounts ADD COLUMN data_sharing_level integer DEFAULT 1;",
		);
		await queryRunner.query(
			"ALTER TABLE connected_accounts ADD COLUMN last_activity_sync timestamp DEFAULT NULL;",
		);
		await queryRunner.query(
			"ALTER TABLE connected_accounts ADD COLUMN privacy_override boolean DEFAULT false;",
		);

		await queryRunner.query(
			"ALTER TABLE user_settings ADD COLUMN connections_default_visibility integer DEFAULT 1;",
		);
		await queryRunner.query(
			"ALTER TABLE user_settings ADD COLUMN connections_activity_sharing boolean DEFAULT true;",
		);
		await queryRunner.query(
			"ALTER TABLE user_settings ADD COLUMN connections_metadata_sharing boolean DEFAULT true;",
		);
		await queryRunner.query(
			"ALTER TABLE user_settings ADD COLUMN connections_require_approval boolean DEFAULT false;",
		);

		await queryRunner.query(
			"CREATE INDEX idx_connected_accounts_visibility ON connected_accounts(visibility);",
		);
		await queryRunner.query(
			"CREATE INDEX idx_connected_accounts_data_sharing ON connected_accounts(data_sharing_level);",
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			"DROP INDEX idx_connected_accounts_visibility;",
		);
		await queryRunner.query(
			"DROP INDEX idx_connected_accounts_data_sharing;",
		);

		await queryRunner.query(
			"ALTER TABLE connected_accounts DROP COLUMN consent_given_at;",
		);
		await queryRunner.query(
			"ALTER TABLE connected_accounts DROP COLUMN data_sharing_level;",
		);
		await queryRunner.query(
			"ALTER TABLE connected_accounts DROP COLUMN last_activity_sync;",
		);
		await queryRunner.query(
			"ALTER TABLE connected_accounts DROP COLUMN privacy_override;",
		);

		await queryRunner.query(
			"ALTER TABLE user_settings DROP COLUMN connections_default_visibility;",
		);
		await queryRunner.query(
			"ALTER TABLE user_settings DROP COLUMN connections_activity_sharing;",
		);
		await queryRunner.query(
			"ALTER TABLE user_settings DROP COLUMN connections_metadata_sharing;",
		);
		await queryRunner.query(
			"ALTER TABLE user_settings DROP COLUMN connections_require_approval;",
		);
	}
}
