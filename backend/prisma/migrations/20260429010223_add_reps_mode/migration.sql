-- CreateEnum
CREATE TYPE "StationMode" AS ENUM ('TIME', 'REPS');

-- AlterTable
ALTER TABLE "CircuitStation" ADD COLUMN     "reps" INTEGER,
ADD COLUMN     "restBetweenSetsSec" INTEGER,
ADD COLUMN     "sets" INTEGER,
ADD COLUMN     "stationMode" "StationMode" NOT NULL DEFAULT 'TIME';
