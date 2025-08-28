import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGeodataSupport1756398565000 implements MigrationInterface {
	name = "AddGeodataSupport1756398565000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE \`messages\` 
			ADD COLUMN \`geo_location\` text,
			ADD COLUMN \`live_location\` text,
			ADD COLUMN \`spatial_query\` text,
			ADD COLUMN \`geofence_data\` text,
			ADD COLUMN \`iot_sensor_data\` text,
			ADD COLUMN \`iot_device_status\` text
		`);

		await queryRunner.query(`
			ALTER TABLE \`channels\` 
			ADD COLUMN \`geofences\` text,
			ADD COLUMN \`location_sharing_enabled\` boolean NOT NULL DEFAULT false,
			ADD COLUMN \`default_location_share_duration_ms\` int
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE \`messages\` 
			DROP COLUMN \`geo_location\`,
			DROP COLUMN \`live_location\`,
			DROP COLUMN \`spatial_query\`,
			DROP COLUMN \`geofence_data\`,
			DROP COLUMN \`iot_sensor_data\`,
			DROP COLUMN \`iot_device_status\`
		`);

		await queryRunner.query(`
			ALTER TABLE \`channels\` 
			DROP COLUMN \`geofences\`,
			DROP COLUMN \`location_sharing_enabled\`,
			DROP COLUMN \`default_location_share_duration_ms\`
		`);
	}
}
