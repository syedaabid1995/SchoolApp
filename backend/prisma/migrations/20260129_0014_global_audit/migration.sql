CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid,
  "actor_id" uuid NOT NULL,
  "actor_role" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "action" text NOT NULL,
  "before_state" jsonb,
  "after_state" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE INDEX "audit_logs_school_id_idx" ON "audit_logs" ("school_id");
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" ("actor_id");
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs" ("entity_type");
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs" ("entity_id");
