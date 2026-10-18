import { MigrationInterface, QueryRunner } from "typeorm";
export class FeedbackReason1789790000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `ALTER TABLE analyses ADD COLUMN "feedbackReason" varchar(500) NULL`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(`ALTER TABLE analyses DROP COLUMN "feedbackReason"`);
  }
}
