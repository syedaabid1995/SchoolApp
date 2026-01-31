CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED');
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "attendance_periods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "name" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "late_threshold_minutes" int NOT NULL DEFAULT 0,
  "early_threshold_minutes" int NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "attendance_periods_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "attendance_periods_school_id_name_key" ON "attendance_periods" ("school_id", "name");
CREATE INDEX "attendance_periods_school_id_idx" ON "attendance_periods" ("school_id");

CREATE TABLE "attendance_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "period_id" uuid NOT NULL,
  "date" timestamptz NOT NULL,
  "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'OPEN',
  "started_by_id" uuid NOT NULL,
  "device_id" text NOT NULL,
  "gps_lat" double precision,
  "gps_lng" double precision,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "attendance_sessions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_sessions_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "attendance_periods" ("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_sessions_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "attendance_sessions_school_id_period_id_date_key" ON "attendance_sessions" ("school_id", "period_id", "date");
CREATE INDEX "attendance_sessions_school_id_idx" ON "attendance_sessions" ("school_id");
CREATE INDEX "attendance_sessions_period_id_idx" ON "attendance_sessions" ("period_id");
CREATE INDEX "attendance_sessions_started_by_id_idx" ON "attendance_sessions" ("started_by_id");

CREATE TABLE "attendance_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "confidence" double precision,
  "captured_at" timestamptz NOT NULL DEFAULT now(),
  "device_id" text NOT NULL,
  "gps_lat" double precision,
  "gps_lng" double precision,
  "manual_override_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions" ("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "attendance_records_session_id_student_id_key" ON "attendance_records" ("session_id", "student_id");
CREATE INDEX "attendance_records_session_id_idx" ON "attendance_records" ("session_id");
CREATE INDEX "attendance_records_student_id_idx" ON "attendance_records" ("student_id");
