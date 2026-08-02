// Builds the Arabic profile + activity block that gets prepended to the
// coach system prompt on every post-onboarding /ai/chat request.
//
// Single export: buildUserContext(userId) → Promise<string>
// Returns "" on missing user or unexpected failure (the route falls back
// to a profile-less prompt rather than 500-ing the chat).

import { prisma } from "./prisma";

// CLEANUP (goal redesign) — synced to the final 5-goal list. Mirrors GoalKey
// in fitai-backend/src/lib/bodyFat.ts and GOAL_LABEL_AR in
// fitai-frontend/src/lib/goalLabels.ts — keep all three in sync if this changes.
const GOAL_AR: Record<string, string> = {
  fat_loss:           "خسارة دهون",
  muscle_gain:        "بناء عضلات",
  bodybuilding:       "تضخيم عضلي",
  body_recomposition: "إعادة تشكيل الجسم",
  strength:           "زيادة القوة",
};

const LEVEL_AR: Record<string, string> = {
  beginner:     "مبتدئ",
  intermediate: "متوسط",
  advanced:     "متقدم",
};

const PLAN_AR: Record<string, string> = {
  free:    "مجاني",
  premium: "بريميوم",
};

// Returns "اليوم" / "أمس" / "قبل يومين" / "قبل N أيام" / "قبل N يوماً"
function relativeDays(date: Date): string {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setUTCHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - target.getTime()) / 86_400_000);

  if (diff <= 0)        return "اليوم";
  if (diff === 1)       return "أمس";
  if (diff === 2)       return "قبل يومين";
  if (diff <= 10)       return `قبل ${diff} أيام`;
  return `قبل ${diff} يوماً`;
}

// "1 يوم" / "يومين" / "N أيام" / "N يوماً" — used for "logged X days out of 7"
function dayCount(n: number): string {
  if (n === 1)  return "يوم واحد";
  if (n === 2)  return "يومين";
  if (n <= 10)  return `${n} أيام`;
  return `${n} يوماً`;
}

export async function buildUserContext(userId: string): Promise<string> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const [
      user,
      latestEntry,
      latestWeighIn,
      workoutsCompleted,
      mealGroups,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.progressEntry.findFirst({
        where:   { userId },
        orderBy: { entryDate: "desc" },
      }),
      prisma.progressEntry.findFirst({
        where:   { userId, weight: { not: null } },
        orderBy: { entryDate: "desc" },
      }),
      prisma.workoutExercise.count({
        where: {
          plan:   { userId },
          doneAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.dailyMealLog.groupBy({
        by:      ["logDate"],
        where:   { userId, logDate: { gte: sevenDaysAgo } },
        _sum:    { calories: true },
      }),
    ]);

    if (!user) return "";

    const lines: string[] = ["=== بيانات المستخدم ==="];
    lines.push(`الاسم: ${user.name}`);
    if (user.age    != null) lines.push(`العمر: ${user.age}`);
    if (user.height != null) lines.push(`الطول: ${user.height} سم`);

    // Current weight: prefer latest weigh-in (with relative date), else User.weight (no date)
    if (latestWeighIn?.weight != null) {
      lines.push(`الوزن الحالي: ${latestWeighIn.weight} كغ (آخر قياس ${relativeDays(latestWeighIn.entryDate)})`);
    } else if (user.weight != null) {
      lines.push(`الوزن الحالي: ${user.weight} كغ`);
    }

    if (user.fitnessLevel && LEVEL_AR[user.fitnessLevel]) {
      lines.push(`المستوى: ${LEVEL_AR[user.fitnessLevel]}`);
    }
    if (user.goal && GOAL_AR[user.goal]) {
      lines.push(`الهدف: ${GOAL_AR[user.goal]}`);
    }
    if (user.diseases?.trim()) {
      lines.push(`الأمراض/الإصابات: ${user.diseases.trim()}`);
    }
    if (user.plan && PLAN_AR[user.plan]) {
      lines.push(`الاشتراك: ${PLAN_AR[user.plan]}`);
    }

    // Measurements: prefer latest ProgressEntry field, fall back to User table.
    // Only render the section if at least one measurement exists.
    const measurement = (latest: number | null | undefined, base: number | null | undefined) =>
      latest ?? base ?? null;

    const m = {
      chest: measurement(latestEntry?.chest, user.chest),
      waist: measurement(latestEntry?.waist, user.waist),
      hips:  measurement(latestEntry?.hips,  user.hips),
      arms:  measurement(latestEntry?.arms,  user.arms),
      legs:  measurement(latestEntry?.legs,  user.legs),
    };
    const mLines: string[] = [];
    if (m.chest != null) mLines.push(`- الصدر: ${m.chest} سم`);
    if (m.waist != null) mLines.push(`- الخصر: ${m.waist} سم`);
    if (m.hips  != null) mLines.push(`- الأرداف: ${m.hips} سم`);
    if (m.arms  != null) mLines.push(`- الذراعين: ${m.arms} سم`);
    if (m.legs  != null) mLines.push(`- الأرجل: ${m.legs} سم`);
    if (mLines.length > 0) {
      lines.push("", "القياسات الحالية:", ...mLines);
    }

    // Current lift weights — for goals where lifts matter, so a plan rebuild can
    // anchor the main lifts to real numbers (heaviest logged, else the frozen
    // onboarding baseline) instead of inventing them.
    if (user.goal && ["strength", "muscle_gain", "bodybuilding"].includes(user.goal)) {
      const liftRows = await prisma.workoutExercise.findMany({
        where:  { plan: { userId }, exerciseType: "strength", actualWeightKg: { not: null } },
        select: { nameEn: true, actualWeightKg: true },
      });
      const maxLift = (kw: string): number | null =>
        liftRows
          .filter((r) => r.nameEn?.toLowerCase().includes(kw))
          .reduce<number | null>((mx, r) => Math.max(mx ?? 0, r.actualWeightKg ?? 0) || null, null);

      const lifts = [
        { ar: "بنش برس",   kw: "bench",    base: user.startBench },
        { ar: "سكوات",     kw: "squat",    base: user.startSquat },
        { ar: "رفعة ميتة", kw: "deadlift", base: user.startDeadlift },
        { ar: "بريس علوي", kw: "overhead", base: user.startOverheadPress },
      ];
      const liftLines = lifts
        .map((l) => {
          const cur = maxLift(l.kw) ?? l.base;
          return cur != null ? `- ${l.ar}: ${cur} كغ` : null;
        })
        .filter((x): x is string => x !== null);
      if (liftLines.length > 0) {
        lines.push("", "أوزان الرفعات الحالية:", ...liftLines);
      }
    }

    // Activity section — always renders (zero is a real signal)
    const daysLogged   = mealGroups.length;
    const totalCal     = mealGroups.reduce((sum, g) => sum + (g._sum.calories ?? 0), 0);
    const avgCal       = daysLogged > 0 ? Math.round(totalCal / daysLogged) : 0;

    lines.push("", "النشاط آخر 7 أيام:");
    lines.push(`- تمارين مكتملة: ${workoutsCompleted}`);
    if (daysLogged === 0) {
      lines.push("- متوسط السعرات اليومية: لم تُسجَّل وجبات هذا الأسبوع");
    } else {
      lines.push(`- متوسط السعرات اليومية: ${avgCal} سعرة (سُجِّلت ${dayCount(daysLogged)} من 7)`);
    }
    if (latestWeighIn) {
      lines.push(`- آخر تسجيل وزن: ${relativeDays(latestWeighIn.entryDate)}`);
    } else {
      lines.push("- آخر تسجيل وزن: لم يُسجَّل بعد");
    }

    return lines.join("\n");
  } catch (err) {
    console.warn("buildUserContext failed:", err);
    return "";
  }
}
