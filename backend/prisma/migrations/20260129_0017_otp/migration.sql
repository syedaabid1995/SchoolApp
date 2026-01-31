CREATE TABLE "otp_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "phone" text NOT NULL,
  "purpose" text NOT NULL DEFAULT 'PARENT_LOGIN',
  "code_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "attempts" int NOT NULL DEFAULT 0,
  "max_attempts" int NOT NULL DEFAULT 5,
  "verified_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "otp_codes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE
);

CREATE INDEX "otp_codes_school_id_idx" ON "otp_codes" ("school_id");
CREATE INDEX "otp_codes_phone_idx" ON "otp_codes" ("phone");
