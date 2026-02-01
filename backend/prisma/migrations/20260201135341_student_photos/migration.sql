CREATE TABLE "student_photos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_photos_student_id_idx" ON "student_photos"("student_id");

ALTER TABLE "student_photos" ADD CONSTRAINT "student_photos_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
