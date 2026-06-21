-- AlterTable: flag exercises/meals the coach has personalized
ALTER TABLE "workout_exercises" ADD COLUMN "coachEdited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "diet_meals"        ADD COLUMN "coachEdited" BOOLEAN NOT NULL DEFAULT false;
