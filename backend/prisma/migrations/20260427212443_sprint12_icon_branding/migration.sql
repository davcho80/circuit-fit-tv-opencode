-- AlterTable
ALTER TABLE "Circuit" ADD COLUMN     "icon" VARCHAR(10);

-- CreateTable
CREATE TABLE "StudioSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "studioName" VARCHAR(100) NOT NULL DEFAULT 'Circuit Fit TV',
    "primaryColor" VARCHAR(7) NOT NULL DEFAULT '#0ea5e9',
    "logoUrl" TEXT,

    CONSTRAINT "StudioSettings_pkey" PRIMARY KEY ("id")
);
