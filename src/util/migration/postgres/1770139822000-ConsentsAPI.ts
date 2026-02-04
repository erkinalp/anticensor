/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { MigrationInterface, QueryRunner } from "typeorm";

export class ConsentsAPI1770139822000 implements MigrationInterface {
    name = "ConsentsAPI1770139822000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
			ALTER TABLE "user_consents" 
			ADD COLUMN IF NOT EXISTS "consent_type" character varying DEFAULT 'custom',
			ADD COLUMN IF NOT EXISTS "item_id" character varying,
			ADD COLUMN IF NOT EXISTS "target_user_id" character varying,
			ADD COLUMN IF NOT EXISTS "status" character varying DEFAULT 'granted',
			ADD COLUMN IF NOT EXISTS "basis_document_url" character varying,
			ADD COLUMN IF NOT EXISTS "basis_document_hash" character varying,
			ADD COLUMN IF NOT EXISTS "granted_at" timestamp,
			ADD COLUMN IF NOT EXISTS "retracted_at" timestamp,
			ADD COLUMN IF NOT EXISTS "expires_at" timestamp,
			ADD COLUMN IF NOT EXISTS "extra_data" text
		`);

        await queryRunner.query(`
			DROP INDEX IF EXISTS "IDX_user_consents_user_id_service_id"
		`);

        await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_consents_user_service_type_item_target" 
			ON "user_consents" ("user_id", "service_id", "consent_type", "item_id", "target_user_id")
		`);

        await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_user_consents_item_id" ON "user_consents" ("item_id")
		`);

        await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_user_consents_target_user_id" ON "user_consents" ("target_user_id")
		`);

        await queryRunner.query(`
			ALTER TABLE "user_consents" 
			ADD CONSTRAINT "FK_user_consents_target_user_id" 
			FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
		`);

        await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "consent_grants" (
				"id" character varying NOT NULL,
				"user_id" character varying NOT NULL,
				"requester_id" character varying NOT NULL,
				"consent_type" character varying DEFAULT 'custom',
				"service_id" character varying,
				"item_id" character varying,
				"status" character varying DEFAULT 'pending',
				"requested_at" timestamp NOT NULL DEFAULT now(),
				"responded_at" timestamp,
				"expires_at" timestamp,
				"interaction_url" character varying,
				"continue_token" character varying,
				"access_token" character varying,
				"requested_access" text,
				"granted_access" text,
				"extra_data" text,
				CONSTRAINT "PK_consent_grants" PRIMARY KEY ("id")
			)
		`);

        await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_consent_grants_user_id" ON "consent_grants" ("user_id")
		`);

        await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_consent_grants_requester_id" ON "consent_grants" ("requester_id")
		`);

        await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_consent_grants_user_requester_service_type" 
			ON "consent_grants" ("user_id", "requester_id", "service_id", "consent_type")
		`);

        await queryRunner.query(`
			ALTER TABLE "consent_grants" 
			ADD CONSTRAINT "FK_consent_grants_user_id" 
			FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
		`);

        await queryRunner.query(`
			ALTER TABLE "consent_grants" 
			ADD CONSTRAINT "FK_consent_grants_requester_id" 
			FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
		`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "consent_grants" DROP CONSTRAINT IF EXISTS "FK_consent_grants_requester_id"`);
        await queryRunner.query(`ALTER TABLE "consent_grants" DROP CONSTRAINT IF EXISTS "FK_consent_grants_user_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_consent_grants_user_requester_service_type"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_consent_grants_requester_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_consent_grants_user_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "consent_grants"`);

        await queryRunner.query(`ALTER TABLE "user_consents" DROP CONSTRAINT IF EXISTS "FK_user_consents_target_user_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_consents_target_user_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_consents_item_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_consents_user_service_type_item_target"`);

        await queryRunner.query(`
			ALTER TABLE "user_consents" 
			DROP COLUMN IF EXISTS "consent_type",
			DROP COLUMN IF EXISTS "item_id",
			DROP COLUMN IF EXISTS "target_user_id",
			DROP COLUMN IF EXISTS "status",
			DROP COLUMN IF EXISTS "basis_document_url",
			DROP COLUMN IF EXISTS "basis_document_hash",
			DROP COLUMN IF EXISTS "granted_at",
			DROP COLUMN IF EXISTS "retracted_at",
			DROP COLUMN IF EXISTS "expires_at",
			DROP COLUMN IF EXISTS "extra_data"
		`);

        await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_consents_user_id_service_id" 
			ON "user_consents" ("user_id", "service_id")
		`);
    }
}
