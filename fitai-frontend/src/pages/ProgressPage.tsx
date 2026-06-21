// src/pages/ProgressPage.tsx
//
// Fix: added saveProfileThunk dispatch after setProfile so measurements
// are saved to the database and survive page refresh.

import { useState } from "react";
import { TrendingDown, TrendingUp, Minus, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { addWeightEntry } from "@/features/progress/progressSlice";
import { setProfile, saveProfileThunk } from "@/features/user/userSlice"; // [added] saveProfileThunk
import { addMessage } from "@/features/chat/chatSlice";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
// import { AnalyticsTab } from "@/components/analytics/AnalyticsTab";
import { getGoalLabel } from "@/lib/goalLabels";

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
] as const;

export function ProgressPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { weightData, streak } = useAppSelector((s) => s.progress);
  const { profile }            = useAppSelector((s) => s.user);

  const [form, setForm] = useState({
    weight: profile.weight || "",
    chest:  profile.chest  || "",
    waist:  profile.waist  || "",
    hips:   profile.hips   || "",
    arms:   profile.arms   || "",
    legs:   profile.legs   || "",
  });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'measurements' | 'analytics'>('measurements');

  const handleSaveAndNotify = () => {
    const changes: string[] = [];

    FIELDS.forEach(({ key, label, unit }) => {
      const oldVal = profile[key as keyof typeof profile] as string | undefined;
      const newVal = form[key as keyof typeof form];
      if (newVal && newVal !== oldVal) {
        changes.push(`${label}: ${oldVal || "غير محدد"} ← ${newVal} ${unit}`);
      }
    });

    if (changes.length === 0) return;

    // Build the updated profile object
    const updatedProfile = {
      weight: form.weight || profile.weight,
      chest:  form.chest  || profile.chest,
      waist:  form.waist  || profile.waist,
      hips:   form.hips   || profile.hips,
      arms:   form.arms   || profile.arms,
      legs:   form.legs   || profile.legs,
    };

    // Update Redux state synchronously for instant UI feedback
    dispatch(setProfile(updatedProfile));

    // [fix] Save the updated measurements to the database
    // Without this, the data only lives in Redux/localStorage and is lost on refresh
    dispatch(saveProfileThunk(updatedProfile));

    // Update the weight chart data if weight changed
    if (form.weight && form.weight !== profile.weight) {
      dispatch(addWeightEntry({
        week:   `تحديث ${weightData.length + 1}`,
        weight: parseFloat(form.weight),
      }));
    }

    // Send an automatic message to the AI to notify it of the changes
    const autoMsg = `[تحديث القياسات]\nقمت بتحديث قياساتي:\n${changes.join("\n")}\n\nهل تحتاج خطتي لأي تعديلات بناءً على هذه التغييرات؟`;
    dispatch(addMessage({ role: "user", text: autoMsg }));

    setSaved(true);
    setTimeout(() => {
      navigate("/chat");
    }, 1500);
  };

  if (!profile.hasCompletedSetup) {
    return (
      <div className="mx-auto max-w-4xl px-6 pt-28">
        <h1 className="mb-2 text-4xl font-black">التقدم 📊</h1>
        <EmptyState icon="📈" title="لا توجد بيانات بعد" desc="أنشئ خطتك مع المساعد الذكي أولاً." />
      </div>
    );
  }

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

      {/* Tab bar */}
      <div className="flex border-b border-zinc-700 mb-6">
        {(['measurements', 'analytics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-indigo-500 text-indigo-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab === 'measurements' ? 'القياسات' : 'التحليل'}
          </button>
        ))}
      </div>

      {activeTab === 'measurements' && (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {[
              { label: "الوزن الابتدائي", val: `${weightData[0]?.weight ?? profile.weight ?? "—"} كغ`, color: "text-slate-300" },
              { label: "الوزن الحالي",    val: `${weightData[weightData.length - 1]?.weight ?? profile.weight ?? "—"} كغ`, color: "text-accent" },
              { label: "أيام الالتزام",   val: `${streak}`, color: "text-brand-blue" },
            ].map(({ label, val, color }) => (
              <Card key={label}>
                <p className="mb-1 text-sm text-slate-500">{label}</p>
                <p className={`text-3xl font-black ${color}`}>{val}</p>
              </Card>
            ))}
          </div>

          {/* Weight chart */}
          {weightData.length > 1 && (
            <Card className="mb-6">
              <h3 className="mb-5 font-bold">منحنى الوزن (كغ) ⚖️</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weightData}>
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
                  ✅ تم الحفظ! جاري الانتقال للمساعد...
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

          {/* User profile card */}
          <Card>
            <h3 className="mb-4 font-bold">ملفك الشخصي</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "الاسم",    val: profile.name },
                { label: "العمر",    val: profile.age    ? `${profile.age} سنة`   : "—" },
                { label: "الطول",    val: profile.height ? `${profile.height} سم` : "—" },
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
      )}
      {/* {activeTab === 'analytics' && <AnalyticsTab />}  */}
    </div>
  );
}