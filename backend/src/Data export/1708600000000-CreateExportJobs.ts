import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExportJobs1708600000000 implements MigrationInterface {
  name = 'CreateExportJobs1708600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "export_resource_type_enum" AS ENUM (
        'TRANSACTIONS', 'MERCHANTS', 'SETTLEMENTS', 'AUDIT_LOGS', 'REFUNDS'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "export_format_enum" AS ENUM ('CSV', 'XLSX')
    `);

    await queryRunner.query(`
      CREATE TYPE "export_status_enum" AS ENUM (
        'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "export_jobs" (
        "id"                   UUID                       NOT NULL DEFAULT gen_random_uuid(),
        "admin_id"             CHARACTER VARYING          NOT NULL,
        "resource_type"        "export_resource_type_enum" NOT NULL,
        "filters"              JSONB                      NOT NULL,
        "format"               "export_format_enum"       NOT NULL,
        "status"               "export_status_enum"       NOT NULL DEFAULT 'QUEUED',
        "estimated_row_count"  INTEGER,
        "actual_row_count"     INTEGER,
        "s3_key"               CHARACTER VARYING,
        "file_size_bytes"      BIGINT,
        "progress_percentage"  INTEGER                    NOT NULL DEFAULT 0,
        "failure_reason"       TEXT,
        "completed_at"         TIMESTAMP WITH TIME ZONE,
        "expires_at"           TIMESTAMP WITH TIME ZONE,
        "created_at"           TIMESTAMP WITH TIME ZONE   NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMP WITH TIME ZONE   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_export_jobs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_export_jobs_admin_id" ON "export_jobs" ("admin_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_export_jobs_status" ON "export_jobs" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "export_jobs"`);
    await queryRunner.query(`DROP TYPE "export_status_enum"`);
    await queryRunner.query(`DROP TYPE "export_format_enum"`);
    await queryRunner.query(`DROP TYPE "export_resource_type_enum"`);
  }
}
