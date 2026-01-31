CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'WHATSAPP', 'SMS', 'EMAIL');
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

CREATE TABLE "notification_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" text NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "subject" text,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "notification_templates_key_key" ON "notification_templates" ("key");

CREATE TABLE "notification_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid,
  "user_id" uuid,
  "channel" "NotificationChannel" NOT NULL,
  "template_id" uuid,
  "payload" jsonb NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
  "provider_id" text,
  "error" text,
  "sent_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "notification_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates" ("id") ON DELETE SET NULL,
  CONSTRAINT "notification_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE SET NULL,
  CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE INDEX "notification_logs_school_id_idx" ON "notification_logs" ("school_id");
CREATE INDEX "notification_logs_user_id_idx" ON "notification_logs" ("user_id");
CREATE INDEX "notification_logs_template_id_idx" ON "notification_logs" ("template_id");
