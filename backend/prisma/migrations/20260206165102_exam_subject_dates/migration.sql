-- AlterTable
ALTER TABLE "exam_papers" ADD COLUMN     "scheduled_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "result_publish_at" TIMESTAMP(3);
