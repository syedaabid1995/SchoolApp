-- CreateTable
CREATE TABLE "totp_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "school_id" UUID,
    "encrypted_secret" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),
    "setup_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "totp_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "totp_backup_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "school_id" UUID,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "totp_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "totp_credentials_user_id_key" ON "totp_credentials"("user_id");

-- CreateIndex
CREATE INDEX "totp_credentials_user_id_idx" ON "totp_credentials"("user_id");

-- CreateIndex
CREATE INDEX "totp_credentials_school_id_idx" ON "totp_credentials"("school_id");

-- CreateIndex
CREATE INDEX "totp_credentials_enabled_at_idx" ON "totp_credentials"("enabled_at");

-- CreateIndex
CREATE INDEX "totp_credentials_disabled_at_idx" ON "totp_credentials"("disabled_at");

-- CreateIndex
CREATE UNIQUE INDEX "totp_backup_codes_code_hash_key" ON "totp_backup_codes"("code_hash");

-- CreateIndex
CREATE INDEX "totp_backup_codes_user_id_idx" ON "totp_backup_codes"("user_id");

-- CreateIndex
CREATE INDEX "totp_backup_codes_school_id_idx" ON "totp_backup_codes"("school_id");

-- CreateIndex
CREATE INDEX "totp_backup_codes_used_at_idx" ON "totp_backup_codes"("used_at");

-- AddForeignKey
ALTER TABLE "totp_credentials" ADD CONSTRAINT "totp_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "totp_credentials" ADD CONSTRAINT "totp_credentials_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "totp_backup_codes" ADD CONSTRAINT "totp_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "totp_backup_codes" ADD CONSTRAINT "totp_backup_codes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
