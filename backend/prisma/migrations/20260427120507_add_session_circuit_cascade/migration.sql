-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_circuitId_fkey";

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
