-- Add database-backed MFA challenges for email OTP login verification.
ALTER TABLE "users"
ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfa_method" TEXT;

CREATE TABLE "mfa_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "school_id" UUID,
    "otp_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mfa_challenges_user_id_idx"
    ON "mfa_challenges"("user_id");

CREATE INDEX "mfa_challenges_school_id_idx"
    ON "mfa_challenges"("school_id");

CREATE INDEX "mfa_challenges_expires_at_idx"
    ON "mfa_challenges"("expires_at");

CREATE INDEX "mfa_challenges_verified_at_idx"
    ON "mfa_challenges"("verified_at");

ALTER TABLE "mfa_challenges"
ADD CONSTRAINT "mfa_challenges_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mfa_challenges"
ADD CONSTRAINT "mfa_challenges_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
