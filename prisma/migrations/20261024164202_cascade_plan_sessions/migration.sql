-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_planId_fkey";

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
