-- CreateEnum
CREATE TYPE "MessagingServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "messaging_services" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MessagingServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "supported_channels" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_messaging_configs" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_messaging_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "messaging_services_code_key" ON "messaging_services"("code");

-- CreateIndex
CREATE INDEX "school_messaging_configs_service_id_idx" ON "school_messaging_configs"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_messaging_configs_school_id_channel_key" ON "school_messaging_configs"("school_id", "channel");

-- AddForeignKey
ALTER TABLE "school_messaging_configs" ADD CONSTRAINT "school_messaging_configs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_messaging_configs" ADD CONSTRAINT "school_messaging_configs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "messaging_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
