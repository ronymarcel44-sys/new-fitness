// src/pages/ProfilePage.tsx
//
// The user's account page ("حسابي"): shows personal/account info, lets them
// edit a few basic fields (name, age, height, level, health notes), and hosts
// the achievements card. Goal type and plan are read-only here (goal changes
// go through the AI coach; plan through the Premium flow).

import { useState, useEffect } from "react";
import { CheckCircle2, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { setProfile, saveProfileThunk } from "@/features/user/userSlice";
import { AchievementsCard } from "@/components/goal/AchievementsCard";
import { getGoalLabel } from "@/lib/goalLabels";

const LEVELS = ["مبتدئ", "متوسط", "متقدم"] as const;

export function ProfilePage() {
  const dispatch = useAppDispatch();
  const { profile } = useAppSelector((s) => s.user);

  const [form, setForm] = useState({
    name:     profile.name     || "",
    age:      profile.age      || "",
    height:   profile.height   || "",
    level:    profile.level    || "",
    diseases: profile.diseases || "",
  });
  const [saved, setSaved] = useState(false);

  // Keep the form in sync as the profile loads (fetched async on app start).
  useEffect(() => {
    setForm({
      name:     profile.name     || "",
      age:      profile.age      || "",
      height:   profile.height   || "",
      level:    profile.level    || "",
      diseases: profile.diseases || "",
    });
  }, [profile.name, profile.age, profile.height, profile.level, profile.diseases]);

  if (!profile.hasCompletedSetup) {
    return (
      <div className="mx-auto max-w-4xl px-6 pt-28">
        <h1 className="mb-2 text-4xl font-black">حسابي 👤</h1>
        <EmptyState icon="🤖" title="أكمل إعدادك أولاً" desc="تحدّث مع المساعد الذكي لإنشاء ملفك وخطتك." />
      </div>
    );
  }

  const genderLabel =
    profile.gender === "male" ? "ذكر" : profile.gender === "female" ? "أنثى" : "غير محدد";
  const isPremium = profile.plan === "premium";

  const handleSave = () => {
    // Partial save — only the basics. Omitted fields (weight, goal, gender,
    // measurements, targets) are left untouched by saveProfileThunk, exactly
    // like the Progress page's measurement-only save.
    const updated = {
      name:     form.name     || profile.name,
      age:      form.age      || profile.age,
      height:   form.height   || profile.height,
      level:    form.level    || profile.level,
      diseases: form.diseases,
    };
    dispatch(setProfile(updated));
    dispatch(saveProfileThunk(updated));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20 pt-28">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-black">حسابي 👤</h1>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-2xl font-bold">{profile.name || "—"}</span>
          {profile.goal && (
            <span className="text-sm text-accent">🎯 {getGoalLabel(profile.goal)}</span>
          )}
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isPremium ? "border border-brand-purple/40 bg-brand-purple/10 text-brand-purple" : "border border-white/10 bg-white/5 text-slate-400"}`}>
            {isPremium ? "بريميوم 👑" : "مجاني"}
          </span>
        </div>
      </div>

      {/* Current weight — read-only stat (edited on the Progress page) */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="mb-1 text-sm text-slate-500">الوزن الحالي</p>
          <p className="text-3xl font-black text-accent">{profile.weight || "—"} كغ</p>
        </Card>
      </div>

      {/* Editable personal info */}
      <Card className="mb-6 border-accent/20">
        <h3 className="mb-5 font-bold">معلوماتي الشخصية</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">الاسم</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-base" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">العمر</label>
            <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="input-base" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">الطول (سم)</label>
            <input type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} className="input-base" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">المستوى</label>
            <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="input-base">
              <option value="">اختر...</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs text-slate-400">حالات صحية / أمراض</label>
            <input type="text" value={form.diseases} onChange={(e) => setForm({ ...form, diseases: e.target.value })} placeholder="لا يوجد" className="input-base" />
          </div>
        </div>
        <div className="mt-5">
          {saved ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 py-3 text-sm font-semibold text-accent">
              <CheckCircle2 className="h-4 w-4" /> تم الحفظ!
            </div>
          ) : (
            <button onClick={handleSave} className="btn-primary w-full text-center glow">
              💾 حفظ التغييرات
            </button>
          )}
        </div>
      </Card>

      {/* Read-only account info */}
      <Card className="mb-6">
        <h3 className="mb-4 font-bold">معلومات الحساب</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-bg px-4 py-3">
            <div className="text-xs text-slate-500">الجنس</div>
            <div className="mt-1 font-semibold">{genderLabel}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-bg px-4 py-3">
            <div className="text-xs text-slate-500">الهدف</div>
            <div className="mt-1 font-semibold">{profile.goal ? getGoalLabel(profile.goal) : "—"}</div>
            <Link to="/chat" className="mt-1 inline-block text-xs text-accent hover:underline">لتغيير هدفك، تحدّث مع المساعد الذكي</Link>
          </div>
          <div className="rounded-xl border border-white/10 bg-bg px-4 py-3">
            <div className="text-xs text-slate-500">الباقة</div>
            <div className="mt-1 font-semibold">{isPremium ? "بريميوم 👑" : "مجاني"}</div>
            {!isPremium && (
              <Link to="/premium" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-purple hover:underline">
                <Crown className="h-3 w-3" /> ترقية
              </Link>
            )}
          </div>
        </div>
      </Card>

      {/* Achievements (moved here from the Progress page) */}
      <AchievementsCard />
    </div>
  );
}
