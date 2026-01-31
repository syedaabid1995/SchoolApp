CREATE TABLE "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "plan_name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz,
  "student_limit" int NOT NULL,
  "teacher_limit" int NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "subscriptions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "subscriptions_school_id_key" ON "subscriptions" ("school_id");
CREATE INDEX "subscriptions_school_id_idx" ON "subscriptions" ("school_id");

CREATE TABLE "usage_counters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "students" int NOT NULL DEFAULT 0,
  "teachers" int NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "usage_counters_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "usage_counters_school_id_key" ON "usage_counters" ("school_id");
