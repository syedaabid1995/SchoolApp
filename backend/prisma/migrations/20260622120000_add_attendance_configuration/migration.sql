DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceMode') THEN
    CREATE TYPE "AttendanceMode" AS ENUM ('DAILY', 'TWICE_DAILY', 'PERIOD_WISE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceConfigurationScope') THEN
    CREATE TYPE "AttendanceConfigurationScope" AS ENUM ('SCHOOL', 'ACADEMIC_YEAR', 'CLASS', 'SECTION');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceUnitType') THEN
    CREATE TYPE "AttendanceUnitType" AS ENUM ('DAY', 'SLOT', 'PERIOD', 'TIMETABLE_ENTRY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceSlotType') THEN
    CREATE TYPE "AttendanceSlotType" AS ENUM ('MORNING', 'AFTERNOON');
  END IF;
END $$;

CREATE TABLE "attendance_configurations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "academic_year_id" UUID,
  "class_id" UUID,
  "section_id" UUID,
  "scope" "AttendanceConfigurationScope" NOT NULL,
  "mode" "AttendanceMode" NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendance_configurations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_configurations_scope_check" CHECK (
    ("scope" = 'SCHOOL' AND "academic_year_id" IS NULL AND "class_id" IS NULL AND "section_id" IS NULL)
    OR ("scope" = 'ACADEMIC_YEAR' AND "academic_year_id" IS NOT NULL AND "class_id" IS NULL AND "section_id" IS NULL)
    OR ("scope" = 'CLASS' AND "academic_year_id" IS NOT NULL AND "class_id" IS NOT NULL AND "section_id" IS NULL)
    OR ("scope" = 'SECTION' AND "academic_year_id" IS NOT NULL AND "class_id" IS NOT NULL AND "section_id" IS NOT NULL)
  ),
  CONSTRAINT "attendance_configurations_effective_range_check" CHECK (
    "effective_to" IS NULL OR "effective_to" >= "effective_from"
  )
);

CREATE TABLE "attendance_slots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "configuration_id" UUID NOT NULL,
  "type" "AttendanceSlotType" NOT NULL,
  "name" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "start_time" TEXT,
  "end_time" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendance_slots_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "attendance_configurations"
  ADD CONSTRAINT "attendance_configurations_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_configurations"
  ADD CONSTRAINT "attendance_configurations_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_configurations"
  ADD CONSTRAINT "attendance_configurations_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_configurations"
  ADD CONSTRAINT "attendance_configurations_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_slots"
  ADD CONSTRAINT "attendance_slots_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_slots"
  ADD CONSTRAINT "attendance_slots_configuration_id_fkey"
  FOREIGN KEY ("configuration_id") REFERENCES "attendance_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "attendance_configurations_school_id_is_active_idx"
  ON "attendance_configurations"("school_id", "is_active");

CREATE INDEX "attendance_configurations_school_id_scope_is_active_idx"
  ON "attendance_configurations"("school_id", "scope", "is_active");

CREATE INDEX "attendance_configurations_school_id_academic_year_id_class_id_section_id_idx"
  ON "attendance_configurations"("school_id", "academic_year_id", "class_id", "section_id");

CREATE INDEX "attendance_configurations_school_id_effective_from_effective_to_idx"
  ON "attendance_configurations"("school_id", "effective_from", "effective_to");

CREATE INDEX "attendance_configurations_school_id_mode_idx"
  ON "attendance_configurations"("school_id", "mode");

CREATE INDEX "attendance_configurations_created_by_id_idx"
  ON "attendance_configurations"("created_by_id");

CREATE INDEX "attendance_configurations_updated_by_id_idx"
  ON "attendance_configurations"("updated_by_id");

CREATE UNIQUE INDEX "attendance_slots_configuration_id_type_key"
  ON "attendance_slots"("configuration_id", "type");

CREATE UNIQUE INDEX "attendance_slots_configuration_id_sequence_key"
  ON "attendance_slots"("configuration_id", "sequence");

CREATE INDEX "attendance_slots_school_id_configuration_id_is_active_idx"
  ON "attendance_slots"("school_id", "configuration_id", "is_active");
