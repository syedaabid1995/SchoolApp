CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "created_by_id" uuid NOT NULL,
  "subject" text NOT NULL,
  "description" text NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
  "sla_due_at" timestamptz,
  "escalation" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "support_tickets_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "support_tickets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE INDEX "support_tickets_school_id_idx" ON "support_tickets" ("school_id");
CREATE INDEX "support_tickets_created_by_id_idx" ON "support_tickets" ("created_by_id");
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" ("status");
