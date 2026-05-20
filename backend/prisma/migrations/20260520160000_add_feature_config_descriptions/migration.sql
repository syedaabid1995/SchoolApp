ALTER TABLE "feature_flags"
ADD COLUMN "name" text,
ADD COLUMN "description" text;

ALTER TABLE "config_entries"
ADD COLUMN "description" text;
