-- Create database-backed refresh sessions for revocable refresh tokens.
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "school_id" UUID,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "device_name" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_sessions_token_hash_key"
    ON "refresh_sessions"("token_hash");

CREATE INDEX "refresh_sessions_user_id_idx"
    ON "refresh_sessions"("user_id");

CREATE INDEX "refresh_sessions_school_id_idx"
    ON "refresh_sessions"("school_id");

CREATE INDEX "refresh_sessions_expires_at_idx"
    ON "refresh_sessions"("expires_at");

CREATE INDEX "refresh_sessions_revoked_at_idx"
    ON "refresh_sessions"("revoked_at");

ALTER TABLE "refresh_sessions"
ADD CONSTRAINT "refresh_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refresh_sessions"
ADD CONSTRAINT "refresh_sessions_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
