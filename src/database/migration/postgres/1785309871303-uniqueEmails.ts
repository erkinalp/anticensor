import { MigrationInterface, QueryRunner } from "typeorm";

export class UniqueEmails1785309871303 implements MigrationInterface {
    name = "UniqueEmails1785309871303";

    public async up(queryRunner: QueryRunner): Promise<void> {
        let rows_affected = 1;
        while (rows_affected > 0) {
            const result = await queryRunner.query(
                `DELETE FROM users WHERE id IN (SELECT u.id FROM users u WHERE u.id = (SELECT u1.id FROM users u1 WHERE u1.email = u.email ORDER BY u1.created_at LIMIT 1) AND (SELECT COUNT(*) FROM users u2 WHERE u2.email = u.email) > 1)`,
                [],
                true,
            );
            rows_affected = result.affected ?? 0;
        }
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3"`);
    }
}
