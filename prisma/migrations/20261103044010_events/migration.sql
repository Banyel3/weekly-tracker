-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CREATED', 'PLANNED', 'UNPLANNED', 'STARTED', 'DONE', 'REOPENED', 'RESCHEDULED', 'ROLLED_BACK', 'ARCHIVED', 'DELETED', 'RESTORED');

-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weekOf" DATE,
    "from" TEXT,
    "to" TEXT,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_idx" ON "TaskEvent"("taskId");

-- CreateIndex
CREATE INDEX "TaskEvent_at_idx" ON "TaskEvent"("at");

-- Backfill from current task fields. Stored timestamps are UTC; Manila is UTC+8 with no DST, so a Manila
-- week start is date_trunc('week', at + 8h). One ROLLED_BACK per task even when rolloverCount > 1.
INSERT INTO "TaskEvent" ("id", "taskId", "type", "at", "weekOf")
SELECT gen_random_uuid()::text, "id", 'CREATED', "createdAt", date_trunc('week', "createdAt" + interval '8 hours')::date
FROM "Task";

INSERT INTO "TaskEvent" ("id", "taskId", "type", "at", "weekOf")
SELECT gen_random_uuid()::text, "id", 'DONE', "completedAt", date_trunc('week', "completedAt" + interval '8 hours')::date
FROM "Task" WHERE "completedAt" IS NOT NULL;

INSERT INTO "TaskEvent" ("id", "taskId", "type", "at", "weekOf")
SELECT gen_random_uuid()::text, "id", 'ROLLED_BACK', "rolledBackAt"::timestamp, "rolledBackAt"
FROM "Task" WHERE "rolledBackAt" IS NOT NULL;

INSERT INTO "TaskEvent" ("id", "taskId", "type", "at", "weekOf")
SELECT gen_random_uuid()::text, "id", 'ARCHIVED', "updatedAt", date_trunc('week', "updatedAt" + interval '8 hours')::date
FROM "Task" WHERE "archived" = true;
