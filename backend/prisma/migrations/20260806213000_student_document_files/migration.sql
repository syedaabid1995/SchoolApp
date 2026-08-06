-- AlterTable
ALTER TABLE "student_documents" ADD COLUMN IF NOT EXISTS "files" JSONB;

-- Backfill existing single-file rows into files[]
UPDATE "student_documents"
SET "files" = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'url', "url",
      'fileName', "file_name",
      'mimeType', "mime_type",
      'sizeBytes', "size_bytes"
    )
  )
)
WHERE "files" IS NULL;
