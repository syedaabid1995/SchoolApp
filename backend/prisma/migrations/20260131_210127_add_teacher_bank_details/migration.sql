CREATE TABLE "teacher_bank_details" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teacher_id" uuid NOT NULL UNIQUE,
  "account_holder_name" text,
  "account_number" text,
  "ifsc_code" text,
  "account_type" text,
  "bank_name" text,
  "branch_name" text,
  "pan_number" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "teacher_bank_details_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profiles" ("id") ON DELETE CASCADE
);

CREATE INDEX "teacher_bank_details_teacher_id_idx" ON "teacher_bank_details" ("teacher_id");
