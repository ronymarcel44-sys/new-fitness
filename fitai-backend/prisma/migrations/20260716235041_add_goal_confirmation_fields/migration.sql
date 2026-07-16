-- AlterTable
ALTER TABLE "daily_meal_logs" ADD COLUMN     "name" TEXT,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "diet_meals" ADD COLUMN     "dayOfWeek" TEXT;

-- AlterTable
ALTER TABLE "progress_entries" ADD COLUMN     "bodyFatPct" DOUBLE PRECISION,
ADD COLUMN     "neck" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "goalConfirmedByAI" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActiveDate" TEXT,
ADD COLUMN     "neck" DOUBLE PRECISION,
ADD COLUMN     "startArms" DOUBLE PRECISION,
ADD COLUMN     "startBodyFatPct" DOUBLE PRECISION,
ADD COLUMN     "startChest" DOUBLE PRECISION,
ADD COLUMN     "startHips" DOUBLE PRECISION,
ADD COLUMN     "startLegs" DOUBLE PRECISION,
ADD COLUMN     "startWaist" DOUBLE PRECISION,
ADD COLUMN     "startWeight" DOUBLE PRECISION,
ADD COLUMN     "streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "targetBenchPress" DOUBLE PRECISION,
ADD COLUMN     "targetBodyFatPct" DOUBLE PRECISION,
ADD COLUMN     "targetCardioDuration" INTEGER,
ADD COLUMN     "targetDeadlift" DOUBLE PRECISION,
ADD COLUMN     "targetLeanMass" DOUBLE PRECISION,
ADD COLUMN     "targetSquat" DOUBLE PRECISION,
ADD COLUMN     "targetWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "workout_exercises" ADD COLUMN     "actualDuration" INTEGER,
ADD COLUMN     "actualWeightKg" DOUBLE PRECISION,
ADD COLUMN     "doneAt" TIMESTAMP(3),
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "exerciseType" TEXT NOT NULL DEFAULT 'strength';
