ALTER TABLE "support_tickets"
ADD COLUMN "assigned_to_id" UUID;

CREATE TABLE "ticket_comments" (
  "id" UUID NOT NULL,
  "ticket_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "school_id" UUID,
  "body" TEXT NOT NULL,
  "is_internal" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_assigned_to_id_idx" ON "support_tickets"("assigned_to_id");

CREATE INDEX "ticket_comments_ticket_id_idx" ON "ticket_comments"("ticket_id");
CREATE INDEX "ticket_comments_author_id_idx" ON "ticket_comments"("author_id");
CREATE INDEX "ticket_comments_school_id_idx" ON "ticket_comments"("school_id");
CREATE INDEX "ticket_comments_created_at_idx" ON "ticket_comments"("created_at");

ALTER TABLE "support_tickets"
ADD CONSTRAINT "support_tickets_assigned_to_id_fkey"
FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ticket_comments"
ADD CONSTRAINT "ticket_comments_ticket_id_fkey"
FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_comments"
ADD CONSTRAINT "ticket_comments_author_id_fkey"
FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_comments"
ADD CONSTRAINT "ticket_comments_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
