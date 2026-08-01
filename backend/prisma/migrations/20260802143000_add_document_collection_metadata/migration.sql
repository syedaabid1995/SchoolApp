ALTER TABLE "student_documents" ADD COLUMN "document_number" TEXT;
ALTER TABLE "staff_documents" ADD COLUMN "document_number" TEXT;

CREATE TABLE "school_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "document_number" TEXT,
  "file_url" TEXT NOT NULL,
  "file_name" TEXT,
  "file_type" TEXT,
  "size_bytes" INTEGER,
  "uploaded_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_documents_school_id_idx" ON "school_documents"("school_id");
CREATE INDEX "school_documents_uploaded_by_id_idx" ON "school_documents"("uploaded_by_id");

ALTER TABLE "school_documents" ADD CONSTRAINT "school_documents_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_documents" ADD CONSTRAINT "school_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
