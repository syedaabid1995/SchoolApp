CREATE TABLE "public"."user_bank_details" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "account_holder_name" TEXT,
  "account_number" TEXT,
  "ifsc_code" TEXT,
  "account_type" TEXT,
  "bank_name" TEXT,
  "branch_name" TEXT,
  "pan_number" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_bank_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_bank_details_user_id_key" ON "public"."user_bank_details"("user_id");
CREATE INDEX "user_bank_details_user_id_idx" ON "public"."user_bank_details"("user_id");

ALTER TABLE "public"."user_bank_details"
  ADD CONSTRAINT "user_bank_details_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
