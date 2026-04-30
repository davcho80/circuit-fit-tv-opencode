CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "actorId" TEXT,
    "actorEmail" VARCHAR(255),
    "actorRole" "UserRole",
    "targetType" VARCHAR(80),
    "targetId" TEXT,
    "ip" VARCHAR(80),
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
