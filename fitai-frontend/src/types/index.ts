// src/types/index.ts

// CLEANUP (goal redesign) — synced to the final 5-goal list. Mirrors the
// GoalKey union in fitai-backend/src/lib/bodyFat.ts and the GOAL_AR map in
// fitai-backend/src/lib/userContext.ts — keep all three in sync if this changes.
// `toning` / `general_fitness` / `endurance` were removed from the product;
// `bodybuilding` was added.
export type GoalKey =
  | "fat_loss"
  | "muscle_gain"
  | "bodybuilding"
  | "body_recomposition"
  | "strength";

export interface UserProfile {
  name: string;
  status?: string;                   // "active" | "disabled" — drives the ban screen
  age: string;
  weight: string;
  height: string;
  goal: GoalKey | "";
  level: string;
  diseases: string;
  gender?: "male" | "female" | "";   // required for the Navy body-fat formula
  chest?: string;
  waist?: string;
  hips?: string;
  arms?: string;
  legs?: string;
  neck?: string;                     // cm, alongside the other measurements
  targetWeight?: string;   // الوزن المستهدف — فارغ = هدف تلقائي (legacy, unrelated feature — see schema comment)
  // Single target per metric (goal redesign) — confirmed once via the AI
  // onboarding flow, no more separate near-term tier. Only the field(s)
  // relevant to the user's goal type are ever populated — see confirmedGoal
  // in ai.routes.ts for which fields map to which goal.
  targetLeanMass?: string; // كغ — no "main" counterpart needed, this name is already unambiguous
  goalConfirmedByAI?: boolean;
  mainTargetWeight?: string;
  mainTargetBodyFatPct?: string;
  mainTargetWaist?: string;         // NEW (goal redesign) — auto-calculated, fat_loss only
  mainTargetHips?: string;          // NEW (goal redesign) — auto-calculated, fat_loss only
  mainTargetNeck?: string;          // NEW (goal redesign) — auto-calculated, fat_loss only
  mainTargetBenchPress?: string;
  mainTargetSquat?: string;
  mainTargetDeadlift?: string;
  mainTargetOverheadPress?: string; // NEW (goal redesign) — strength's 4th lift
  // قيم البداية المجمّدة (للتقدّم منذ البداية) — يديرها الباك-إند
  startWeight?: string;
  startChest?: string;
  startWaist?: string;
  startHips?: string;
  startArms?: string;
  startLegs?: string;
  startNeck?: string;                // NEW (goal redesign)
  startBench?: string;               // NEW (Phase 2) — frozen lift baselines from onboarding
  startSquat?: string;
  startDeadlift?: string;
  startOverheadPress?: string;
  hasCompletedSetup: boolean;
  plan?: "free" | "premium";
}

// Coach earnings + withdrawal history (simulated money)
export interface CoachEarnings {
  perClient:       number;
  sharePct:        number;
  monthlyEarnings: number;
  projectedYearly: number;
  available:       number;
  totalWithdrawn:  number;
  clients:         { id: string; name: string; amount: number }[];
  withdrawals:     { id: string; amount: number; method: string; createdAt: string }[];
}

// A bell notification for either a user or a coach
export interface AppNotification {
  id:            string;
  recipientId:   string;
  recipientRole: "user" | "coach";
  type:          string;   // new_message | new_client
  text:          string;
  link:          string | null;
  read:          boolean;
  createdAt:     string;
}

// A direct chat message between a premium user and their coach
export interface CoachMessage {
  id:         string;
  userId:     string;
  coachId:    string;
  senderRole: "user" | "coach";
  text:       string;
  read:       boolean;
  createdAt:  string;
}

// A coach certificate — a coach can hold several. `type` is a known body
// (ISSA/NASM/ACE/NSCA/ACSM) or the literal "أخرى", in which case `typeOther`
// holds the free-text name. `number` is the license number.
export interface Certificate {
  type: string;
  number: string;
  typeOther?: string;
}
// User-facing variant — the license number is stripped server-side, so users
// only ever receive the certificate type.
export type PublicCertificate = Pick<Certificate, "type" | "typeOther">;

// A human coach as surfaced to a premium user (assigned coach or pickable coach).
// Distinct from the admin-facing `Coach` type below, which also carries assignedUsers.
export interface AssignedCoach {
  id: string;
  name: string;
  specialty: string;
  email?: string;
  status?: string;
  bio?: string | null;
  yearsExperience?: number | null;
  certification?: string | null;              // legacy single field (admin-created coaches)
  certifications?: PublicCertificate[];       // numbers stripped for the user side
  clientCount?: number;                       // current active clients ("متدرب حالياً")
  profileImage?: string | null;
}

export interface Exercise {
  id: string;
  name: string;
  nameEn: string;
  sets: string;
  reps: string;
  rest: string;
  weight: string;
  notes: string;
  muscleGroup: string;
  done: boolean;
  coachEdited?: boolean;
  exerciseType?: "cardio" | "strength";  // NEW (Task 4)
  durationMinutes?: number | null;       // NEW (Task 4) — cardio only, AI-prescribed target
  actualWeightKg?: number | null;        // NEW (Task 6) — logged when marking a strength exercise done
  actualDuration?: number | null;        // NEW (Task 6) — logged when marking a cardio exercise done
}

export interface DayWorkout {
  type: "تمرين" | "راحة";
  focus: string;
  exercises: Exercise[];
}

export interface WeeklyPlan {
  الأحد:    DayWorkout;
  الاثنين:  DayWorkout;
  الثلاثاء: DayWorkout;
  الأربعاء: DayWorkout;
  الخميس:   DayWorkout;
  الجمعة:   DayWorkout;
  السبت:    DayWorkout;
}

export interface WorkoutPlan {
  exercises: Exercise[];
  weeklyPlan?: WeeklyPlan;
}

export interface Meal {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  items: string[];
  emoji: string;
  dayOfWeek?: string;
  source?: "plan" | "ai_analyzer" | "manual";
  coachEdited?: boolean;
}

export interface NutritionPlan {
  totalCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: Meal[];
}

export interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: number;
}

export interface WeightEntry {
  week: string;
  weight: number;
}

export interface MeasurementEntry {
  date:    string; // YYYY-MM-DD
  weight?: number;
  chest?:  number;
  waist?:  number;
  hips?:   number;
  arms?:   number;
  legs?:   number;
}

export interface DailyNutritionSummary {
  date:          string; // YYYY-MM-DD
  totalCalories: number;
  totalProtein:  number;
  totalCarbs:    number;
  totalFat:      number;
}

export interface WorkoutDaySummary {
  date:         string;   // YYYY-MM-DD
  completed:    number;   // exercises marked done that day
  muscleGroups: string[]; // e.g. ["صدر", "كتف"]
}

// ── Admin Types ──────────────────────────────────────────────────

export type UserRole   = "user" | "admin" | "coach";
export type UserPlan   = "free" | "premium";
export type UserStatus = "active" | "disabled";
export type CoachSpecialty = "قوة عضلية" | "تخسيس" | "لياقة عامة";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: UserPlan;
  status: UserStatus;
  joinedAt: string;
  lastActive: string;
  hasWorkoutPlan: boolean;
  streak: number;
  coachId?: string;
}

export interface Coach {
  id: string;
  name: string;
  email: string;
  specialty: CoachSpecialty;
  assignedUsers: string[];
  status: "pending" | "active" | "inactive" | "rejected";
  // Verification credentials — present for self-registered coaches, null for admin-created
  bio?: string | null;
  yearsExperience?: number | null;
  certification?: string | null;          // legacy single field
  certifications?: Certificate[];         // multiple certs (type + number) — admin sees numbers
}

export interface AdminStats {
  totalUsers: number;
  activeToday: number;
  premiumUsers: number;
  totalPlansGenerated: number;
  aiCallsToday: number;
  aiCallsThisMonth: number;
}

export interface AISettings {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

export interface AdminExercise {
  id: string;
  nameAr: string;
  nameEn: string;
  muscleGroup: string;
  level: "مبتدئ" | "متوسط" | "متقدم";
  equipment: string;
  description: string;
}

// ── Shared Constants ─────────────────────────────────────────────

export const DAYS_ORDER = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
] as const;

export type DayName = typeof DAYS_ORDER[number];