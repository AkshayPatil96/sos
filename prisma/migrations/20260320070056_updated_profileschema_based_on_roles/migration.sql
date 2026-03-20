-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ChangeRequestField" ADD VALUE 'SECTION';
ALTER TYPE "ChangeRequestField" ADD VALUE 'DESIGNATION';
ALTER TYPE "ChangeRequestField" ADD VALUE 'JOINING_DATE';
ALTER TYPE "ChangeRequestField" ADD VALUE 'REPORTING_TO';
ALTER TYPE "ChangeRequestField" ADD VALUE 'ADMISSION_DATE';
ALTER TYPE "ChangeRequestField" ADD VALUE 'ACADEMIC_YEAR';

-- CreateIndex
CREATE INDEX "PasswordSetupToken_tokenHash_idx" ON "PasswordSetupToken"("tokenHash");
