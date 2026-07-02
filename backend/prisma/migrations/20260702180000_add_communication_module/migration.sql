-- Add school-scoped communication notices.
CREATE TABLE "communication_notices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "audience" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_notices_pkey" PRIMARY KEY ("id")
);

-- Make notification templates and logs usable for school communication workflows.
ALTER TABLE "notification_templates" ADD COLUMN "school_id" UUID;
ALTER TABLE "notification_templates" ADD COLUMN "name" TEXT;
ALTER TABLE "notification_logs" ADD COLUMN "scheduled_at" TIMESTAMP(3);

CREATE INDEX "communication_notices_school_id_idx" ON "communication_notices"("school_id");
CREATE INDEX "communication_notices_school_id_status_published_at_idx" ON "communication_notices"("school_id", "status", "published_at");
CREATE INDEX "communication_notices_created_by_id_idx" ON "communication_notices"("created_by_id");
CREATE INDEX "notification_templates_school_id_idx" ON "notification_templates"("school_id");
CREATE INDEX "notification_templates_school_id_channel_idx" ON "notification_templates"("school_id", "channel");
CREATE INDEX "notification_logs_school_id_channel_created_at_idx" ON "notification_logs"("school_id", "channel", "created_at");
CREATE INDEX "notification_logs_school_id_channel_scheduled_at_idx" ON "notification_logs"("school_id", "channel", "scheduled_at");

ALTER TABLE "communication_notices"
  ADD CONSTRAINT "communication_notices_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "communication_notices"
  ADD CONSTRAINT "communication_notices_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_templates"
  ADD CONSTRAINT "notification_templates_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
