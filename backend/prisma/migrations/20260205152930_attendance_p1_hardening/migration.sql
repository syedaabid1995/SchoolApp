-- CreateIndex
CREATE INDEX "student_attendance_records_session_id_status_idx" ON "student_attendance_records"("session_id", "status");

-- CreateIndex
CREATE INDEX "student_attendance_sessions_school_id_class_id_date_status_idx" ON "student_attendance_sessions"("school_id", "class_id", "date", "status");
