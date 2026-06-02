CREATE TABLE IF NOT EXISTS "dormitories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "intake" INTEGER NOT NULL,
  "address" TEXT,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dormitories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dormitories_school_id_name_key" ON "dormitories"("school_id", "name");
CREATE INDEX IF NOT EXISTS "dormitories_school_id_idx" ON "dormitories"("school_id");

DO $$ BEGIN
  ALTER TABLE "dormitories" ADD CONSTRAINT "dormitories_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "dormitory_room_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dormitory_room_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dormitory_room_types_school_id_name_key" ON "dormitory_room_types"("school_id", "name");
CREATE INDEX IF NOT EXISTS "dormitory_room_types_school_id_idx" ON "dormitory_room_types"("school_id");

DO $$ BEGIN
  ALTER TABLE "dormitory_room_types" ADD CONSTRAINT "dormitory_room_types_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "dormitory_rooms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "dormitory_id" UUID NOT NULL,
  "room_type_id" UUID NOT NULL,
  "room_number" TEXT NOT NULL,
  "bed_count" INTEGER NOT NULL,
  "cost_per_bed" DECIMAL(10, 2) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dormitory_rooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dormitory_rooms_school_id_dormitory_id_room_number_room_type_id_key"
  ON "dormitory_rooms"("school_id", "dormitory_id", "room_number", "room_type_id");
CREATE INDEX IF NOT EXISTS "dormitory_rooms_school_id_idx" ON "dormitory_rooms"("school_id");
CREATE INDEX IF NOT EXISTS "dormitory_rooms_dormitory_id_idx" ON "dormitory_rooms"("dormitory_id");
CREATE INDEX IF NOT EXISTS "dormitory_rooms_room_type_id_idx" ON "dormitory_rooms"("room_type_id");

DO $$ BEGIN
  ALTER TABLE "dormitory_rooms" ADD CONSTRAINT "dormitory_rooms_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "dormitory_rooms" ADD CONSTRAINT "dormitory_rooms_dormitory_id_fkey"
    FOREIGN KEY ("dormitory_id") REFERENCES "dormitories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "dormitory_rooms" ADD CONSTRAINT "dormitory_rooms_room_type_id_fkey"
    FOREIGN KEY ("room_type_id") REFERENCES "dormitory_room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "student_dormitory_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "dormitory_id" UUID NOT NULL,
  "room_id" UUID,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "vacated_at" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_dormitory_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_dormitory_assignments_school_id_idx" ON "student_dormitory_assignments"("school_id");
CREATE INDEX IF NOT EXISTS "student_dormitory_assignments_student_id_idx" ON "student_dormitory_assignments"("student_id");
CREATE INDEX IF NOT EXISTS "student_dormitory_assignments_dormitory_id_idx" ON "student_dormitory_assignments"("dormitory_id");
CREATE INDEX IF NOT EXISTS "student_dormitory_assignments_room_id_idx" ON "student_dormitory_assignments"("room_id");
CREATE INDEX IF NOT EXISTS "student_dormitory_assignments_active_idx" ON "student_dormitory_assignments"("active");

DO $$ BEGIN
  ALTER TABLE "student_dormitory_assignments" ADD CONSTRAINT "student_dormitory_assignments_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "student_dormitory_assignments" ADD CONSTRAINT "student_dormitory_assignments_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "student_dormitory_assignments" ADD CONSTRAINT "student_dormitory_assignments_dormitory_id_fkey"
    FOREIGN KEY ("dormitory_id") REFERENCES "dormitories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "student_dormitory_assignments" ADD CONSTRAINT "student_dormitory_assignments_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "dormitory_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
