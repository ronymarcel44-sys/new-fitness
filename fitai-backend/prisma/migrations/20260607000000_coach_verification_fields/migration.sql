-- AlterTable: add self-registration / verification credential fields to coaches
ALTER TABLE "coaches" ADD COLUMN "bio" TEXT;
ALTER TABLE "coaches" ADD COLUMN "yearsExperience" INTEGER;
ALTER TABLE "coaches" ADD COLUMN "certification" TEXT;
