CREATE TYPE "FaceProfileStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "face_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "status" "FaceProfileStatus" NOT NULL DEFAULT 'PENDING',
  "created_by_id" uuid NOT NULL,
  "approved_by_id" uuid,
  "approved_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "face_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "face_profiles_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE,
  CONSTRAINT "face_profiles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT,
  CONSTRAINT "face_profiles_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "face_profiles_student_id_key" ON "face_profiles" ("student_id");
CREATE INDEX "face_profiles_school_id_idx" ON "face_profiles" ("school_id");
CREATE INDEX "face_profiles_created_by_id_idx" ON "face_profiles" ("created_by_id");
CREATE INDEX "face_profiles_approved_by_id_idx" ON "face_profiles" ("approved_by_id");

CREATE TABLE "face_samples" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "face_profile_id" uuid NOT NULL,
  "image_url" text NOT NULL,
  "embedding" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "face_samples_face_profile_id_fkey" FOREIGN KEY ("face_profile_id") REFERENCES "face_profiles" ("id") ON DELETE CASCADE
);

CREATE INDEX "face_samples_face_profile_id_idx" ON "face_samples" ("face_profile_id");
