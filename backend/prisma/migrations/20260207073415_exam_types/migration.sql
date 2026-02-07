-- AlterTable
ALTER TABLE "exams"
ALTER COLUMN "type" TYPE TEXT USING "type"::text;

-- CreateTable
CREATE TABLE "exam_types" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_types_school_id_idx" ON "exam_types"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_types_school_id_code_key" ON "exam_types"("school_id", "code");

-- AddForeignKey
ALTER TABLE "exam_types" ADD CONSTRAINT "exam_types_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
