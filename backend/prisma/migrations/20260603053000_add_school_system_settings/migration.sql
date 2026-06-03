CREATE TABLE "school_system_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "general" JSONB NOT NULL DEFAULT '{}',
    "payment_gateways" JSONB NOT NULL DEFAULT '[]',
    "base_setups" JSONB NOT NULL DEFAULT '{}',
    "sessions" JSONB NOT NULL DEFAULT '[]',
    "holidays" JSONB NOT NULL DEFAULT '[]',
    "weekends" JSONB NOT NULL DEFAULT '[]',
    "sms_settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_system_settings_school_id_key"
    ON "school_system_settings"("school_id");

CREATE INDEX "school_system_settings_school_id_idx"
    ON "school_system_settings"("school_id");

ALTER TABLE "school_system_settings"
ADD CONSTRAINT "school_system_settings_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
