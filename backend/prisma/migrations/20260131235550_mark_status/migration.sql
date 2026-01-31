-- CreateEnum
CREATE TYPE "MarkStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');

-- AlterTable
ALTER TABLE "marks" ADD COLUMN     "status" "MarkStatus" NOT NULL DEFAULT 'DRAFT';

