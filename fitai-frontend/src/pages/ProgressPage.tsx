// src/pages/ProgressPage.tsx
//
// Fix: added saveProfileThunk dispatch after setProfile so measurements
// are saved to the database and survive page refresh.

import { useState, useEffect } from "react";
import { TrendingDown, TrendingUp, Minus, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { addWeightEntryThunk, fetchProgressThunk } from "@/features/progress/progressSlice";
import { setProfile, saveProfileThunk } from "@/features/user/userSlice"; // [added] saveProfileThunk
import { addMessage } from "@/features/chat/chatSlice";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getGoalLabel } from "@/lib/goalLabels";
import { StreakJourneyCard } from "@/components/goal/StreakJourneyCard";
import { GoalJourneyCard } from "@/components/goal/GoalJourneyCard";
import { AchievementsCard } from "@/components/goal/AchievementsCard";
import { MeasurementsProgressCard } from "@/components/goal/MeasurementsProgressCard";
import { celebrate } from "@/features/celebration/celebrationSlice";
import { isWeightGoal, goalDirection, autoTargetWeight, computeMilestones } from "@/lib/goalTracker";

const tooltipStyle = {
  backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, color: "#F1F5F9", fontFamily: "Tajawal, sans-serif",
};

const FIELDS = [
  { key: "weight", label: "الوزن",    unit: "كغ", emoji: "⚖️" },
  { key: "chest",  label: "الصدر",    unit: "سم", emoji: "💪" },
  { key: "waist",  label: "الخصر",    unit: "سم", emoji: "📏" },
  { key: "hips",   label: "الأرداف",  unit: "سم", emoji: "🍑" },
  { key: "arms",   label: "الذراعين", unit: "سم", emoji: "💪" },
  { key: "legs",   label: "الأرجل",   unit: "سم", emoji: "🦵" },
  { key: "neck",   label: "الرقبة",   unit: "سم", emoji: "🧣" }, // NEW (Task 3)
] as const;

export function ProgressPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { weightData, bestStreak } = useAppSelector((s) => s.progress);
  const { profile }            = useAppSelector((s) => s.user);

  const [form, setForm] = useState({
    weight: profile.weight || "",
    chest:  profile.chest  || "",
    waist:  profile.waist  || "",
    hips:   profile.hips   || "",
    arms:   profile.arms   || "",
    legs:   profile.legs   || "",
    neck:   profile.neck   || "", // NEW (Task 3)
  });
  // "redirect" = numeric changes were saved and we're navigating to chat;
  // "silent" = e.g. gender-only save, nothing to tell the AI, stay on the page
  const [saved, setSaved] = useState<false | "redirect" | "silent">(false); // NEW (Task 3) — was boolean
  // NEW (Task 3) — one-time gender select. Only rendered while profile.gender
  // is empty; once saved, the field disappears here and shows read-only in the
  // profile card below instead — see design discussion.
  const [genderForm, setGenderForm] = useState<"male" | "female" | "">("");

  // Keep the form in sync with the profile as it loads/changes. The profile is
  // fetched asynchronously on app start, so without this the inputs would stay
  // empty after a refresh (and a save would then wipe the measurements).
  useEffect(() => {
    setForm({
      weight: profile.weight || "",
      chest:  profile.chest  || "",
      waist:  profile.waist  || "",
      hips:   profile.hips   || "",
      arms:   profile.arms   || "",
      legs:   profile.legs   || "",
      neck:   profile.neck   || "", // NEW (Task 3)
    });
  }, [profile.weight, profile.chest, profile.waist, profile.hips, profile.arms, profile.legs, profile.neck]);

  const handleSaveAndNotify = async () => {
    const changes: string[] = [];

    FIELDS.forEach(({ key, label, unit }) => {
      const oldVal = profile[key as keyof typeof profile] as string | undefined;
      const newVal = form[key as keyof typeof form];
      if (newVal && newVal !== oldVal) {
        changes.push(`${label}: ${oldVal || "غير محدد"} ← ${newVal} ${unit}`);
      }
    });

    // NEW (Task 3) — gender is set once via the selector below (not part of
    // FIELDS/changes tracking, since it's not a re-entered numeric measurement)
    const genderChanged = genderForm !== "" && genderForm !== profile.gender;

    if (changes.length === 0 && !genderChanged) return;

    // Build the updated profile object (falls back to existing values per field)
    const updatedProfile = {
      weight: form.weight || profile.weight,
      chest:  form.chest  || profile.chest,
      waist:  form.waist  || profile.waist,
      hips:   form.hips   || profile.hips,
      arms:   form.arms   || profile.arms,
      legs:   form.legs   || profile.legs,
      neck:   form.neck   || profile.neck,     // NEW (Task 3)
      gender: genderForm  || profile.gender,   // NEW (Task 3)
    };

    // 1. Save current measurements to the user profile (User table) for instant
    //    UI + so the profile card / form keep the latest values.
    dispatch(setProfile(updatedProfile));
    dispatch(saveProfileThunk(updatedProfile));

    // 2. Persist a dated progress entry (weight + measurements) to the DB so the
    //    weight chart and the coach's progress view have real history that
    //    survives a refresh. The backend upserts one entry per day.
    const weightVal = parseFloat(updatedProfile.weight || "0");
    if (weightVal > 0) {
      await dispatch(addWeightEntryThunk({
        weight: weightVal,
        chest:  updatedProfile.chest,
        waist:  updatedProfile.waist,
        hips:   updatedProfile.hips,
        arms:   updatedProfile.arms,
        legs:   updatedProfile.legs,
        neck:   updatedProfile.neck, // NEW (Task 3)
      }));
      dispatch(fetchProgressThunk());   // rebuild the chart from the DB

      // Celebrate a newly-crossed weight milestone (or reaching the goal).
      if (isWeightGoal(profile.goal)) {
        const oldW   = parseFloat(profile.weight || "0");
        const start  = parseFloat(profile.startWeight || "") || weightData[0]?.weight || oldW;
        const dir    = goalDirection(profile.goal);
        const userT  = profile.targetWeight ? parseFloat(profile.targetWeight) : null;
        const target = (userT && userT > 0) ? userT : (autoTargetWeight(profile.goal, start, oldW) ?? oldW);
        const hitBefore = dir === "down" ? oldW <= target : oldW >= target;
        const hitAfter  = dir === "down" ? weightVal <= target : weightVal >= target;
        if (hitAfter && !hitBefore) {
          dispatch(celebrate({ emoji: "🏆", title: "وصلت لهدفك!", message: `${target} كغ — إنجاز رائع! 🎉` }));
        } else {
          const newly = computeMilestones(start, target, weightVal, dir)
            .filter((m) => m.reached && (dir === "down" ? oldW > m.value : oldW < m.value));
          if (newly.length > 0) {
            const m = newly[newly.length - 1];
            dispatch(celebrate({ emoji: "🎯", title: "محطة جديدة!", message: `وصلت ${m.value} كغ — استمر!` }));
          }
        }
      }
    }

    // 3. Tell the AI about the changes so it can suggest plan tweaks.
    // NEW (Task 3) — only when there were actual measurement changes; a
    // gender-only save has nothing for the AI to react to, so skip the
    // message and the redirect to chat.
    if (changes.length > 0) {
      const autoMsg = `[تحديث القياسات]\nقمت بتحديث قياساتي:\n${changes.join("\n")}\n\nهل تحتاج خطتي لأي تعديلات بناءً على هذه التغييرات؟`;
      dispatch(addMessage({ role: "user", text: autoMsg }));

      setSaved("redirect");
      setTimeout(() => {
        navigate("/chat");
      }, 1500);
    } else {
      setSaved("silent");
      setTimeout(() => setSaved(false), 1500);
    }
  };

  if (!profile.hasCompletedSetup) {
    return (
      <div className="mx-auto max-w-4xl px-6 pt-28">
        <h1 className="mb-2 text-4xl font-black">التقدم 📊</h1>
        <EmptyState icon="📈" title="لا توجد بيانات بعد" desc="أنشئ خطتك مع المساعد الذكي أولاً." />
      </div>
    );
  }

  // Build the chart data. The first point is always the user's *starting* weight
  // (frozen at onboarding in `startWeight`), so the curve truly begins where the
  // user began — even on day one, where the onboarding weight and a same-day
  // update would otherwise collapse into a single history row. We prepend the
  // start point unless the saved history already begins exactly there.
  const startW = parseFloat(profile.startWeight || "");
  const hist = weightData.map((e) => e.weight);
  const beginsAtStart = hist.length > 0 && Math.abs(hist[0] - startW) < 0.05;
  const series = startW > 0 && !beginsAtStart ? [startW, ...hist] : hist;
  const chartData = series.map((weight, i) => ({
    week: i === 0 ? "البداية" : `تحديث ${i}`,
    weight,
  }));

  const getChange = (key: string) => {
    const oldVal = parseFloat(profile[key as keyof typeof profile] as string || "0");
    const newVal = parseFloat(form[key as keyof typeof form] || "0");
    if (!oldVal || !newVal || oldVal === newVal) return null;
    return newVal - oldVal;
  };

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20 pt-28">
      <h1 className="mb-2 text-4xl font-black">التقدم 📊</h1>
      <p className="mb-8 text-slate-400">عدّل قياساتك وسيُبلَّغ الـ AI تلقائياً ليقترح تعديلات على خطتك</p>

      <>
          {/* Goal journey — universal streak goal (shown for every goal type) */}
          <StreakJourneyCard />

          {/* Goal-specific journey (weight goals) */}
          <GoalJourneyCard />

          {/* Summary cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {[
              { label: "الوزن الابتدائي", val: `${profile.startWeight || weightData[0]?.weight || profile.weight || "—"} كغ`, color: "text-slate-300" },
              { label: "الوزن الحالي",    val: `${profile.weight || weightData[weightData.length - 1]?.weight || "—"} كغ`, color: "text-accent" },
              { label: "أطول سلسلة",     val: `${bestStreak} يوم`, color: "text-brand-orange" },
            ].map(({ label, val, color }) => (
              <Card key={label}>
                <p className="mb-1 text-sm text-slate-500">{label}</p>
                <p className={`text-3xl font-black ${color}`}>{val}</p>
              </Card>
            ))}
          </div>

          {/* Weight chart */}
          {chartData.length > 1 && (
            <Card className="mb-6">
              <h3 className="mb-5 font-bold">منحنى الوزن (كغ) ⚖️</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="week" stroke="#4B5563" tick={{ fill: "#4B5563", fontFamily: "Tajawal", fontSize: 12 }} />
                  <YAxis stroke="#4B5563" tick={{ fill: "#4B5563", fontFamily: "Tajawal", fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="weight" stroke="#00E5A0" strokeWidth={2.5} dot={{ fill: "#00E5A0", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Measurements form */}
          <Card className="mb-6 border-accent/20">
            <div className="mb-5 flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-accent" />
              <h3 className="font-bold">تحديث قياساتك</h3>
            </div>

            {/* NEW (Task 3) — one-time gender select, needed for the body-fat
                formula. Disappears once saved; shown read-only below instead. */}
            {!profile.gender && (
              <div className="mb-5">
                <label className="mb-1.5 block text-xs text-slate-400">
                  ⚧ الجنس <span className="text-slate-600">(مطلوب لحساب نسبة الدهون)</span>
                </label>
                <select
                  value={genderForm}
                  onChange={(e) => setGenderForm(e.target.value as "male" | "female" | "")}
                  className="input-base w-full sm:w-1/3"
                >
                  <option value="">اختر...</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map(({ key, label, unit, emoji }) => {
                const change = getChange(key);
                return (
                  <div key={key}>
                    <label className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-slate-400">{emoji} {label} ({unit})</span>
                      {change !== null && (
                        <span className={`flex items-center gap-0.5 font-semibold ${change < 0 ? "text-accent" : "text-red-400"}`}>
                          {change > 0 ? <TrendingUp className="h-3 w-3" /> : change < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {change > 0 ? "+" : ""}{change.toFixed(1)}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      placeholder={profile[key as keyof typeof profile] as string || "—"}
                      className="input-base"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-5">
              {saved ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 py-3 text-sm font-semibold text-accent">
                  {saved === "redirect" ? "✅ تم الحفظ! جاري الانتقال للمساعد..." : "✅ تم الحفظ!"}
                </div>
              ) : (
                <button onClick={handleSaveAndNotify} className="btn-primary w-full text-center glow">
                  💾 حفظ وإبلاغ الـ AI بالتغييرات
                </button>
              )}
              <p className="mt-2 text-center text-xs text-slate-600">
                سيتحقق الـ AI من التغييرات ويقترح تعديلات على خطتك إذا لزم
              </p>
            </div>
          </Card>

          {/* Measurements progress since baseline */}
          <MeasurementsProgressCard />

          {/* Achievements badges */}
          <AchievementsCard />

          {/* User profile card */}
          <Card>
            <h3 className="mb-4 font-bold">ملفك الشخصي</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "الاسم",    val: profile.name },
                { label: "العمر",    val: profile.age    ? `${profile.age} سنة`   : "—" },
                { label: "الطول",    val: profile.height ? `${profile.height} سم` : "—" },
                { label: "الجنس",    val: profile.gender === "male" ? "ذكر" : profile.gender === "female" ? "أنثى" : "—" }, // NEW (Task 3)
                { label: "الهدف",    val: getGoalLabel(profile.goal) },
                { label: "المستوى", val: profile.level  },
                { label: "الأمراض", val: profile.diseases || "لا يوجد" },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-bg px-4 py-3">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-1 font-semibold">{val}</div>
                </div>
              ))}
            </div>
          </Card>
      </>
    </div>
  );
}