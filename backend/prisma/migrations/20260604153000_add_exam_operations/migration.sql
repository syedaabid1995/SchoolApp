CREATE TABLE "exam_centers" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_centers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_rooms" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "floor" TEXT,
    "capacity" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,
    "columns" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_seating_allocations" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "exam_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "seat_row" INTEGER NOT NULL,
    "seat_column" INTEGER NOT NULL,
    "seat_number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_seating_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_invigilator_assignments" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "exam_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_invigilator_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_centers_school_id_code_key" ON "exam_centers"("school_id", "code");
CREATE INDEX "exam_centers_school_id_idx" ON "exam_centers"("school_id");

CREATE UNIQUE INDEX "exam_rooms_school_id_center_id_code_key" ON "exam_rooms"("school_id", "center_id", "code");
CREATE INDEX "exam_rooms_school_id_idx" ON "exam_rooms"("school_id");
CREATE INDEX "exam_rooms_center_id_idx" ON "exam_rooms"("center_id");

CREATE UNIQUE INDEX "exam_seating_allocations_exam_id_student_id_key" ON "exam_seating_allocations"("exam_id", "student_id");
CREATE UNIQUE INDEX "exam_seating_allocations_exam_id_room_id_seat_number_key" ON "exam_seating_allocations"("exam_id", "room_id", "seat_number");
CREATE INDEX "exam_seating_allocations_school_id_idx" ON "exam_seating_allocations"("school_id");
CREATE INDEX "exam_seating_allocations_exam_id_idx" ON "exam_seating_allocations"("exam_id");
CREATE INDEX "exam_seating_allocations_student_id_idx" ON "exam_seating_allocations"("student_id");
CREATE INDEX "exam_seating_allocations_room_id_idx" ON "exam_seating_allocations"("room_id");

CREATE UNIQUE INDEX "exam_invigilator_assignments_exam_id_teacher_id_key" ON "exam_invigilator_assignments"("exam_id", "teacher_id");
CREATE UNIQUE INDEX "exam_invigilator_assignments_exam_id_room_id_key" ON "exam_invigilator_assignments"("exam_id", "room_id");
CREATE INDEX "exam_invigilator_assignments_school_id_idx" ON "exam_invigilator_assignments"("school_id");
CREATE INDEX "exam_invigilator_assignments_exam_id_idx" ON "exam_invigilator_assignments"("exam_id");
CREATE INDEX "exam_invigilator_assignments_teacher_id_idx" ON "exam_invigilator_assignments"("teacher_id");
CREATE INDEX "exam_invigilator_assignments_room_id_idx" ON "exam_invigilator_assignments"("room_id");

ALTER TABLE "exam_centers" ADD CONSTRAINT "exam_centers_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_rooms" ADD CONSTRAINT "exam_rooms_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_rooms" ADD CONSTRAINT "exam_rooms_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "exam_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_seating_allocations" ADD CONSTRAINT "exam_seating_allocations_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_seating_allocations" ADD CONSTRAINT "exam_seating_allocations_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_seating_allocations" ADD CONSTRAINT "exam_seating_allocations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_seating_allocations" ADD CONSTRAINT "exam_seating_allocations_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "exam_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exam_seating_allocations" ADD CONSTRAINT "exam_seating_allocations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "exam_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exam_invigilator_assignments" ADD CONSTRAINT "exam_invigilator_assignments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_invigilator_assignments" ADD CONSTRAINT "exam_invigilator_assignments_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_invigilator_assignments" ADD CONSTRAINT "exam_invigilator_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exam_invigilator_assignments" ADD CONSTRAINT "exam_invigilator_assignments_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "exam_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exam_invigilator_assignments" ADD CONSTRAINT "exam_invigilator_assignments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "exam_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
