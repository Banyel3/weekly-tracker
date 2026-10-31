-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NONE', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "checklist" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "priority" "Priority" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "rolloverCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AppState" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppState_pkey" PRIMARY KEY ("key")
);

-- Backfill
UPDATE "Task" SET "completedAt" = "updatedAt" WHERE status = 'DONE' AND "completedAt" IS NULL;
