CREATE TYPE "TransferRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "student_transfer_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" uuid NOT NULL,
  "from_school_id" uuid NOT NULL,
  "to_school_id" uuid NOT NULL,
  "requested_by_id" uuid NOT NULL,
  "decided_by_id" uuid,
  "status" "TransferRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" text,
  "decided_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "student_transfer_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE,
  CONSTRAINT "student_transfer_requests_from_school_id_fkey" FOREIGN KEY ("from_school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "student_transfer_requests_to_school_id_fkey" FOREIGN KEY ("to_school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "student_transfer_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT,
  CONSTRAINT "student_transfer_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE INDEX "student_transfer_requests_student_id_idx" ON "student_transfer_requests" ("student_id");
CREATE INDEX "student_transfer_requests_from_school_id_idx" ON "student_transfer_requests" ("from_school_id");
CREATE INDEX "student_transfer_requests_to_school_id_idx" ON "student_transfer_requests" ("to_school_id");
CREATE INDEX "student_transfer_requests_status_idx" ON "student_transfer_requests" ("status");
