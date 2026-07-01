CREATE TABLE "demo_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "school_name" TEXT NOT NULL,
    "role" TEXT,
    "student_count" INTEGER NOT NULL,
    "staff_count" INTEGER NOT NULL,
    "preferred_date" TIMESTAMP(3),
    "message" TEXT,
    "selected_plan_id" UUID,
    "selected_plan_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approval_token" TEXT,
    "approval_token_expires_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by_id" UUID,
    "email_delivery_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "demo_requests_approval_token_key" ON "demo_requests"("approval_token");
CREATE INDEX "demo_requests_status_idx" ON "demo_requests"("status");
CREATE INDEX "demo_requests_email_idx" ON "demo_requests"("email");
CREATE INDEX "demo_requests_created_at_idx" ON "demo_requests"("created_at");
CREATE INDEX "demo_requests_selected_plan_id_idx" ON "demo_requests"("selected_plan_id");
CREATE INDEX "demo_requests_approved_by_id_idx" ON "demo_requests"("approved_by_id");

ALTER TABLE "demo_requests" ADD CONSTRAINT "demo_requests_selected_plan_id_fkey" FOREIGN KEY ("selected_plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "demo_requests" ADD CONSTRAINT "demo_requests_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
