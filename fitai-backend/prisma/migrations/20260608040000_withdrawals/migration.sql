-- CreateTable: coach earnings withdrawals (simulated)
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "withdrawals_coachId_idx" ON "withdrawals"("coachId");

ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
