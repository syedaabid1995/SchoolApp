CREATE TYPE "SchoolOnboardingStatus" AS ENUM ('DRAFT', 'SETUP_IN_PROGRESS', 'READY_FOR_REVIEW', 'ACTIVE', 'BLOCKED');

ALTER TABLE "schools"
  ADD COLUMN "onboarding_status" "SchoolOnboardingStatus" NOT NULL DEFAULT 'DRAFT';

CREATE TABLE "school_onboarding_checklists" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "required" BOOLEAN NOT NULL DEFAULT true,
  "completed_at" TIMESTAMP(3),
  "completed_by_id" UUID,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_onboarding_checklists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_onboarding_checklists_school_id_key_key"
  ON "school_onboarding_checklists"("school_id", "key");

CREATE INDEX "school_onboarding_checklists_school_id_idx"
  ON "school_onboarding_checklists"("school_id");

CREATE INDEX "school_onboarding_checklists_completed_by_id_idx"
  ON "school_onboarding_checklists"("completed_by_id");

ALTER TABLE "school_onboarding_checklists"
  ADD CONSTRAINT "school_onboarding_checklists_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school_onboarding_checklists"
  ADD CONSTRAINT "school_onboarding_checklists_completed_by_id_fkey"
  FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
