CREATE TYPE "SubscriptionPlan" AS ENUM ('STARTER', 'STANDARD', 'PREMIUM');

ALTER TABLE "schools"
  ALTER COLUMN "subscription_plan" TYPE "SubscriptionPlan"
  USING (upper("subscription_plan")::"SubscriptionPlan");
