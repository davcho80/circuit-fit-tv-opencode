-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "RotationMode" AS ENUM ('CLASSIC', 'FIXED');

-- CreateEnum
CREATE TYPE "DisplayRole" AS ENUM ('STATION', 'CENTRAL', 'UNASSIGNED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "PhaseType" AS ENUM ('TRANSITION', 'WORK', 'REST');

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(280),
    "videoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "muscleGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" "Difficulty" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circuit" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "rounds" INTEGER NOT NULL,
    "workSec" INTEGER NOT NULL,
    "restSec" INTEGER NOT NULL,
    "transitionSec" INTEGER NOT NULL,
    "rotationMode" "RotationMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Circuit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircuitStation" (
    "id" TEXT NOT NULL,
    "circuitId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CircuitStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircuitStationExercise" (
    "stationId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,

    CONSTRAINT "CircuitStationExercise_pkey" PRIMARY KEY ("stationId","exerciseId")
);

-- CreateTable
CREATE TABLE "Display" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "role" "DisplayRole" NOT NULL DEFAULT 'UNASSIGNED',
    "stationNumber" INTEGER,
    "lastSeen" TIMESTAMP(3),
    "deviceModel" TEXT,
    "deviceOs" TEXT,
    "appVersion" TEXT,
    "pairedAt" TIMESTAMP(3),

    CONSTRAINT "Display_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "circuitId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'RUNNING',
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "currentPhase" "PhaseType" NOT NULL DEFAULT 'TRANSITION',
    "currentStationIdx" INTEGER NOT NULL DEFAULT 0,
    "phaseEndsAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "remainingOnPauseMs" INTEGER,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CircuitStation_circuitId_position_key" ON "CircuitStation"("circuitId", "position");

-- AddForeignKey
ALTER TABLE "CircuitStation" ADD CONSTRAINT "CircuitStation_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircuitStationExercise" ADD CONSTRAINT "CircuitStationExercise_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "CircuitStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircuitStationExercise" ADD CONSTRAINT "CircuitStationExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
