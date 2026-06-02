CREATE TABLE IF NOT EXISTS "transport_routes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "fare" DECIMAL(10,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_routes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "transport_routes_school_id_title_key" ON "transport_routes"("school_id", "title");
CREATE INDEX IF NOT EXISTS "transport_routes_school_id_idx" ON "transport_routes"("school_id");

DO $$
BEGIN
  ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "transport_vehicles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "vehicle_number" TEXT NOT NULL,
  "vehicle_model" TEXT NOT NULL,
  "year_made" INTEGER,
  "driver_name" TEXT NOT NULL,
  "driver_license" TEXT NOT NULL,
  "driver_contact" TEXT NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_vehicles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "transport_vehicles_school_id_vehicle_number_key" ON "transport_vehicles"("school_id", "vehicle_number");
CREATE INDEX IF NOT EXISTS "transport_vehicles_school_id_idx" ON "transport_vehicles"("school_id");

DO $$
BEGIN
  ALTER TABLE "transport_vehicles" ADD CONSTRAINT "transport_vehicles_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "transport_route_vehicles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "route_id" UUID NOT NULL,
  "vehicle_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_route_vehicles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "transport_route_vehicles_route_id_vehicle_id_key" ON "transport_route_vehicles"("route_id", "vehicle_id");
CREATE INDEX IF NOT EXISTS "transport_route_vehicles_school_id_idx" ON "transport_route_vehicles"("school_id");
CREATE INDEX IF NOT EXISTS "transport_route_vehicles_route_id_idx" ON "transport_route_vehicles"("route_id");
CREATE INDEX IF NOT EXISTS "transport_route_vehicles_vehicle_id_idx" ON "transport_route_vehicles"("vehicle_id");

DO $$
BEGIN
  ALTER TABLE "transport_route_vehicles" ADD CONSTRAINT "transport_route_vehicles_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "transport_route_vehicles" ADD CONSTRAINT "transport_route_vehicles_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "transport_route_vehicles" ADD CONSTRAINT "transport_route_vehicles_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "transport_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "student_transport_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "route_id" UUID NOT NULL,
  "vehicle_id" UUID,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dropped_at" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_transport_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_transport_assignments_school_id_idx" ON "student_transport_assignments"("school_id");
CREATE INDEX IF NOT EXISTS "student_transport_assignments_student_id_idx" ON "student_transport_assignments"("student_id");
CREATE INDEX IF NOT EXISTS "student_transport_assignments_route_id_idx" ON "student_transport_assignments"("route_id");
CREATE INDEX IF NOT EXISTS "student_transport_assignments_vehicle_id_idx" ON "student_transport_assignments"("vehicle_id");
CREATE INDEX IF NOT EXISTS "student_transport_assignments_active_idx" ON "student_transport_assignments"("active");

DO $$
BEGIN
  ALTER TABLE "student_transport_assignments" ADD CONSTRAINT "student_transport_assignments_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "student_transport_assignments" ADD CONSTRAINT "student_transport_assignments_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "student_transport_assignments" ADD CONSTRAINT "student_transport_assignments_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "student_transport_assignments" ADD CONSTRAINT "student_transport_assignments_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "transport_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
