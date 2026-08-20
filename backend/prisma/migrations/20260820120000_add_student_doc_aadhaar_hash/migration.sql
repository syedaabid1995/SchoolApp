ALTER TABLE "students" ADD COLUMN "doc_aadhaar_hash" TEXT;

CREATE INDEX "students_school_id_doc_aadhaar_hash_idx" ON "students"("school_id", "doc_aadhaar_hash");
