CREATE UNIQUE INDEX IF NOT EXISTS "attendance_sessions_unit_identity_key"
  ON "attendance_sessions"(
    "school_id",
    "academic_year_id",
    "class_id",
    COALESCE("section_id", '00000000-0000-0000-0000-000000000000'::uuid),
    "date",
    "unit_type",
    COALESCE("slot_id", '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE("period_id", '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE("timetable_entry_id", '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE "academic_year_id" IS NOT NULL
    AND "class_id" IS NOT NULL
    AND "unit_type" IS NOT NULL;

ALTER TABLE "attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_unit_reference_check"
  CHECK (
    "unit_type" IS NULL
    OR (
      ("unit_type" = 'DAY' AND "slot_id" IS NULL AND "period_id" IS NULL AND "timetable_entry_id" IS NULL)
      OR ("unit_type" = 'SLOT' AND "slot_id" IS NOT NULL AND "period_id" IS NULL AND "timetable_entry_id" IS NULL)
      OR ("unit_type" = 'PERIOD' AND "slot_id" IS NULL AND "period_id" IS NOT NULL AND "timetable_entry_id" IS NULL)
      OR ("unit_type" = 'TIMETABLE_ENTRY' AND "slot_id" IS NULL AND "period_id" IS NOT NULL AND "timetable_entry_id" IS NOT NULL)
    )
  );

ALTER TABLE "attendance_slots"
  ADD CONSTRAINT "attendance_slots_type_sequence_check"
  CHECK (
    ("type" = 'MORNING' AND "sequence" = 1)
    OR ("type" = 'AFTERNOON' AND "sequence" = 2)
  );
