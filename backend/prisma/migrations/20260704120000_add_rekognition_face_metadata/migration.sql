ALTER TABLE "face_samples"
  ADD COLUMN "school_id" uuid,
  ADD COLUMN "class_id" uuid,
  ADD COLUMN "section_id" uuid,
  ADD COLUMN "image_key" text,
  ADD COLUMN "collection_id" text,
  ADD COLUMN "rekognition_face_id" text;

UPDATE "face_samples" AS fs
SET
  "school_id" = fp."school_id",
  "class_id" = s."class_id",
  "section_id" = s."section_id"
FROM "face_profiles" AS fp
JOIN "students" AS s ON s."id" = fp."student_id"
WHERE fs."face_profile_id" = fp."id";

CREATE UNIQUE INDEX "face_samples_collection_id_rekognition_face_id_key"
  ON "face_samples" ("collection_id", "rekognition_face_id");
CREATE INDEX "face_samples_school_id_class_id_section_id_idx"
  ON "face_samples" ("school_id", "class_id", "section_id");
CREATE INDEX "face_samples_collection_id_idx" ON "face_samples" ("collection_id");
CREATE INDEX "face_samples_rekognition_face_id_idx" ON "face_samples" ("rekognition_face_id");
