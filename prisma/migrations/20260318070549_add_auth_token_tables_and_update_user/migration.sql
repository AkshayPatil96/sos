/*
  Warnings:

  - You are about to drop the column `data` on the `AdminProfile` table. All the data in the column will be lost.
  - You are about to drop the column `data` on the `StaffProfile` table. All the data in the column will be lost.
  - You are about to drop the column `data` on the `StudentProfile` table. All the data in the column will be lost.
  - You are about to drop the column `data` on the `SuperAdminProfile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[employeeId]` on the table `AdminProfile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[employeeId]` on the table `StaffProfile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[enrollmentNumber]` on the table `StudentProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('GRANT', 'DENY');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('GLOBAL', 'SECTION');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChangeRequestField" AS ENUM ('NAME', 'DATE_OF_BIRTH', 'EMAIL', 'ENROLLMENT_NUMBER', 'EMPLOYEE_ID', 'DEPARTMENT', 'COURSE', 'BATCH');

-- AlterTable
ALTER TABLE "AdminProfile" DROP COLUMN "data",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "emergencyContact" JSONB,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "joiningDate" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "profilePhotoKey" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "severity" "AuditSeverity" NOT NULL DEFAULT 'LOW',
ADD COLUMN     "userEmail" TEXT,
ADD COLUMN     "userRole" TEXT;

-- AlterTable
ALTER TABLE "StaffProfile" DROP COLUMN "data",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "emergencyContact" JSONB,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "joiningDate" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "profilePhotoKey" TEXT,
ADD COLUMN     "reportingTo" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "StudentProfile" DROP COLUMN "data",
ADD COLUMN     "academicYear" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "admissionDate" TIMESTAMP(3),
ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "batch" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "course" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "department" TEXT,
ADD COLUMN     "emergencyContact" JSONB,
ADD COLUMN     "enrollmentNumber" TEXT,
ADD COLUMN     "guardianName" TEXT,
ADD COLUMN     "guardianPhone" TEXT,
ADD COLUMN     "guardianRelation" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "profilePhotoKey" TEXT,
ADD COLUMN     "section" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "SuperAdminProfile" DROP COLUMN "data",
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "profilePhotoKey" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ProfileChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" "ChangeRequestField" NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "scopeType" "PermissionScope" NOT NULL DEFAULT 'GLOBAL',
    "scopeId" TEXT,
    "effect" "PermissionEffect" NOT NULL DEFAULT 'GRANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileChangeRequest_userId_idx" ON "ProfileChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "ProfileChangeRequest_status_idx" ON "ProfileChangeRequest"("status");

-- CreateIndex
CREATE INDEX "ProfileChangeRequest_field_idx" ON "ProfileChangeRequest"("field");

-- CreateIndex
CREATE INDEX "ProfileChangeRequest_reviewedBy_idx" ON "ProfileChangeRequest"("reviewedBy");

-- CreateIndex
CREATE INDEX "ProfileChangeRequest_createdAt_idx" ON "ProfileChangeRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ProfileChangeRequest_status_createdAt_idx" ON "ProfileChangeRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- CreateIndex
CREATE INDEX "UserPermission_permissionId_idx" ON "UserPermission"("permissionId");

-- CreateIndex
CREATE INDEX "UserPermission_scopeType_scopeId_idx" ON "UserPermission"("scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_permissionId_scopeType_scopeId_key" ON "UserPermission"("userId", "permissionId", "scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_tokenHash_idx" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_employeeId_key" ON "AdminProfile"("employeeId");

-- CreateIndex
CREATE INDEX "AdminProfile_department_idx" ON "AdminProfile"("department");

-- CreateIndex
CREATE INDEX "AdminProfile_employeeId_idx" ON "AdminProfile"("employeeId");

-- CreateIndex
CREATE INDEX "AuditLog_userEmail_idx" ON "AuditLog"("userEmail");

-- CreateIndex
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");

-- CreateIndex
CREATE INDEX "AuditLog_severity_createdAt_idx" ON "AuditLog"("severity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_employeeId_key" ON "StaffProfile"("employeeId");

-- CreateIndex
CREATE INDEX "StaffProfile_department_idx" ON "StaffProfile"("department");

-- CreateIndex
CREATE INDEX "StaffProfile_employeeId_idx" ON "StaffProfile"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_enrollmentNumber_key" ON "StudentProfile"("enrollmentNumber");

-- CreateIndex
CREATE INDEX "StudentProfile_department_idx" ON "StudentProfile"("department");

-- CreateIndex
CREATE INDEX "StudentProfile_course_idx" ON "StudentProfile"("course");

-- CreateIndex
CREATE INDEX "StudentProfile_batch_idx" ON "StudentProfile"("batch");

-- CreateIndex
CREATE INDEX "StudentProfile_enrollmentNumber_idx" ON "StudentProfile"("enrollmentNumber");

-- CreateIndex
CREATE INDEX "User_createdById_idx" ON "User"("createdById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileChangeRequest" ADD CONSTRAINT "ProfileChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileChangeRequest" ADD CONSTRAINT "ProfileChangeRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
