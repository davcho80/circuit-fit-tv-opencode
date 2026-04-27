-- AlterEnum
ALTER TYPE "PhaseType" ADD VALUE 'HYDRATION';

-- CreateTable
CREATE TABLE "ScheduledBreak" (
    "id" TEXT NOT NULL,
    "circuitId" TEXT NOT NULL,
    "afterRound" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Pause eau',

    CONSTRAINT "ScheduledBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledBreak_circuitId_idx" ON "ScheduledBreak"("circuitId");

-- AddForeignKey
ALTER TABLE "ScheduledBreak" ADD CONSTRAINT "ScheduledBreak_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
