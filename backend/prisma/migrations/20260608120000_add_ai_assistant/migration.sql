CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "school_id" UUID,
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tool_name" TEXT,
    "tool_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_pending_actions" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "school_id" UUID,
    "tool_name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "risk" TEXT NOT NULL DEFAULT 'LOW',
    "summary" TEXT,
    "created_by_id" UUID NOT NULL,
    "executed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_at" TIMESTAMP(3),

    CONSTRAINT "ai_pending_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_conversations_school_id_idx" ON "ai_conversations"("school_id");
CREATE INDEX "ai_conversations_user_id_idx" ON "ai_conversations"("user_id");
CREATE INDEX "ai_conversations_status_idx" ON "ai_conversations"("status");

CREATE INDEX "ai_messages_conversation_id_idx" ON "ai_messages"("conversation_id");
CREATE INDEX "ai_messages_user_id_idx" ON "ai_messages"("user_id");
CREATE INDEX "ai_messages_role_idx" ON "ai_messages"("role");

CREATE INDEX "ai_pending_actions_conversation_id_idx" ON "ai_pending_actions"("conversation_id");
CREATE INDEX "ai_pending_actions_school_id_idx" ON "ai_pending_actions"("school_id");
CREATE INDEX "ai_pending_actions_created_by_id_idx" ON "ai_pending_actions"("created_by_id");
CREATE INDEX "ai_pending_actions_status_idx" ON "ai_pending_actions"("status");

ALTER TABLE "ai_conversations"
ADD CONSTRAINT "ai_conversations_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_conversations"
ADD CONSTRAINT "ai_conversations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_messages"
ADD CONSTRAINT "ai_messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_messages"
ADD CONSTRAINT "ai_messages_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_pending_actions"
ADD CONSTRAINT "ai_pending_actions_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_pending_actions"
ADD CONSTRAINT "ai_pending_actions_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_pending_actions"
ADD CONSTRAINT "ai_pending_actions_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_pending_actions"
ADD CONSTRAINT "ai_pending_actions_executed_by_id_fkey"
FOREIGN KEY ("executed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'ai.assistant.view', 'View AI assistant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ai.assistant.use', 'Use AI assistant chat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ai.assistant.execute', 'Execute confirmed AI assistant actions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ai.assistant.admin', 'Administer AI assistant settings', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."code" IN ('ai.assistant.view', 'ai.assistant.use', 'ai.assistant.execute', 'ai.assistant.admin')
WHERE r."name" IN ('SUPER_ADMIN', 'SCHOOL_ADMIN')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "subscription_plan_permissions" ("id", "plan_id", "permission_code", "enabled", "created_at", "updated_at")
SELECT gen_random_uuid(), sp."id", p."code", TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "subscription_plans" sp
CROSS JOIN "permissions" p
WHERE p."code" IN ('ai.assistant.view', 'ai.assistant.use', 'ai.assistant.execute', 'ai.assistant.admin')
ON CONFLICT ("plan_id", "permission_code") DO NOTHING;
