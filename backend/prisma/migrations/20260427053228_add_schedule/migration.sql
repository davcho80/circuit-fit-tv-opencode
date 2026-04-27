-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "circuitId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "daysOfWeek" INTEGER[],
    "timeHour" INTEGER NOT NULL,
    "timeMinute" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Montreal',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Schedule_isActive_idx" ON "Schedule"("isActive");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
