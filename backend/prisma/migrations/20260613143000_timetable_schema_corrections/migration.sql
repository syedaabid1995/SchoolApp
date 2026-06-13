-- Add period typing to canonical attendance periods.
ALTER TABLE "attendance_periods"
ADD COLUMN IF NOT EXISTS "type" "TimePeriodType" NOT NULL DEFAULT 'CLASS_TIME';

-- Preserve known legacy period semantics when an attendance period matches a legacy time period.
UPDATE "attendance_periods" AS ap
SET "type" = tp."type"
FROM "time_periods" AS tp
WHERE ap."school_id" = tp."school_id"
  AND lower(trim(ap."name")) = lower(trim(tp."name"))
  AND ap."start_time" = tp."start_time"
  AND ap."end_time" = tp."end_time";

DROP INDEX IF EXISTS "attendance_periods_school_id_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_periods_school_id_type_name_key"
ON "attendance_periods"("school_id", "type", "name");

CREATE INDEX IF NOT EXISTS "attendance_periods_school_id_type_idx"
ON "attendance_periods"("school_id", "type");

-- Add normalized room reference to modern timetable entries while keeping the legacy room label.
ALTER TABLE "timetable_entries"
ADD COLUMN IF NOT EXISTS "class_room_id" UUID;

UPDATE "timetable_entries" AS te
SET "class_room_id" = cr."id"
FROM "class_rooms" AS cr
WHERE te."class_room_id" IS NULL
  AND te."room" IS NOT NULL
  AND te."school_id" = cr."school_id"
  AND lower(trim(te."room")) = lower(trim(cr."room_number"));

CREATE INDEX IF NOT EXISTS "timetable_entries_class_room_id_idx"
ON "timetable_entries"("class_room_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'timetable_entries_class_room_id_fkey'
  ) THEN
    ALTER TABLE "timetable_entries"
    ADD CONSTRAINT "timetable_entries_class_room_id_fkey"
    FOREIGN KEY ("class_room_id")
    REFERENCES "class_rooms"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
