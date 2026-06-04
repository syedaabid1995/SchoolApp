ALTER TABLE "school_system_settings"
ADD COLUMN IF NOT EXISTS "fee_challan_banks" JSONB NOT NULL DEFAULT '[]';
