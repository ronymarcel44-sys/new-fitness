// fitai-backend/prisma/seed.ts
//
// Seeds a default admin (and a sample active coach) so a fresh install has a
// working admin login on any machine. Idempotent — safe to run multiple times.
//
// Run with:  npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── Default admin ───────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("admin123", 12);
  await prisma.admin.upsert({
    where:  { email: "admin@fitai.com" },
    update: {},
    create: {
      email:        "admin@fitai.com",
      name:         "المدير",
      passwordHash: adminPassword,
      role:         "admin",
    },
  });

  // ── Sample coach (active, so it shows up for premium users) ──────
  const coachPassword = await bcrypt.hash("coach123", 12);
  await prisma.coach.upsert({
    where:  { email: "coach@fitai.com" },
    update: {},
    create: {
      email:        "coach@fitai.com",
      name:         "المدرب التجريبي",
      passwordHash: coachPassword,
      specialty:    "قوة عضلية",
      status:       "active",
    },
  });

  console.log("✅ Seed complete:");
  console.log("   Admin → admin@fitai.com / admin123");
  console.log("   Coach → coach@fitai.com / coach123");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
