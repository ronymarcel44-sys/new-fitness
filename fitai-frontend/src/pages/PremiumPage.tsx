// src/pages/PremiumPage.tsx
// صفحة الترقية للبريميوم — تعرض حالة المستخدم الحقيقية (من قاعدة البيانات)
// وتتيح الترقية عبر Stripe Checkout (وضع الاختبار)، ثم اختيار مدرب بشري.

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Lock, CheckCircle2, Zap, UserCheck, Brain, Dumbbell, Loader2, AlertTriangle, Award, RefreshCw, UserX } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  confirmPaymentThunk,
  fetchAvailableCoachesThunk,
  chooseCoachThunk,
  removeCoachThunk,
} from "@/features/user/userSlice";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CoachAvatar } from "@/components/coach/CoachAvatar";
import { CoachDetailModal } from "@/components/coach/CoachDetailModal";
import type { AssignedCoach } from "@/types";

// مميزات البريميوم — كل ميزة لها icon ووصف
const PREMIUM_FEATURES = [
  { icon: UserCheck, label: "مدرب بشري مخصص",      desc: "مدرب حقيقي يراجع خطتك ويعدّلها ويترك ملاحظات شخصية",  premium: true  },
  { icon: Brain,     label: "تعديل الخطة يدوياً",  desc: "المدرب يضبط التمارين والوجبات بناءً على تقدمك الفعلي",  premium: true  },
  { icon: Dumbbell,  label: "ملاحظات على التمارين", desc: "تعليمات مخصصة على كل تمرين من المدرب مباشرة",           premium: true  },
  { icon: Zap,       label: "خطة AI غير محدودة",   desc: "أنشئ وأعد إنشاء خطتك متى تريد بدون قيود",              premium: false },
  { icon: Zap,       label: "تتبع كامل للتقدم",    desc: "رسوم بيانية، قياسات، وسلسلة أيام",                      premium: false },
  { icon: Zap,       label: "مساعد AI 24/7",        desc: "أجب على أي سؤال رياضي أو غذائي في أي وقت",             premium: false },
];

// خطط الأسعار — وضع اختبار Stripe، لا يُخصم أي مبلغ حقيقي
const PLANS = {
  monthly: { label: "شهري",  price: "$10",  per: "/شهر", note: "" },
  annual:  { label: "سنوي",  price: "$84",  per: "/سنة", note: "وفّر 30% — أي $7/شهر" },
} as const;

type Interval = keyof typeof PLANS;

export function PremiumPage() {
  const dispatch = useAppDispatch();
  const [params, setParams] = useSearchParams();

  const { profile, coach, availableCoaches } = useAppSelector((s) => s.user);
  const isPremium = profile.plan === "premium";

  const [interval, setInterval]     = useState<Interval>("annual");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [canceled, setCanceled]     = useState(false);
  const [error, setError]           = useState("");
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [switching, setSwitching]   = useState(false);  // show picker to change coach
  const [removing, setRemoving]     = useState(false);
  const [detailCoach, setDetailCoach] = useState<AssignedCoach | null>(null); // coach open in the detail popup

  // عند العودة من Stripe: نتحقق من الدفع ونرقّي الحساب، أو نعرض إلغاء الدفع
  useEffect(() => {
    const sessionId = params.get("session_id");
    const wasCanceled = params.get("canceled");

    if (sessionId) {
      setConfirming(true);
      dispatch(confirmPaymentThunk(sessionId))
        .unwrap()
        .then(() => dispatch(fetchAvailableCoachesThunk()))
        .catch(() => setError("تعذّر تأكيد الدفع، تواصل معنا إذا تم الخصم"))
        .finally(() => setConfirming(false));
      params.delete("session_id");
      setParams(params, { replace: true });
    } else if (wasCanceled) {
      setCanceled(true);
      params.delete("canceled");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // عندما يكون المستخدم بريميوم ولم يختر مدرباً بعد — نجلب قائمة المدربين المتاحين
  useEffect(() => {
    if (isPremium && !coach && availableCoaches.length === 0) {
      dispatch(fetchAvailableCoachesThunk());
    }
  }, [isPremium, coach, availableCoaches.length, dispatch]);

  // بدء الدفع عبر Stripe
  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    setError("");
    try {
      const { url } = await apiRequest<{ url: string }>(
        "POST", "/payment/create-checkout-session", { interval }
      );
      window.location.href = url;
    } catch {
      setError("تعذّر بدء عملية الدفع، حاول مرة أخرى");
      setCheckoutLoading(false);
    }
  };

  // اختيار / تغيير مدرب
  const handleChooseCoach = (coachId: string) => {
    setChoosingId(coachId);
    dispatch(chooseCoachThunk(coachId))
      .unwrap()
      .then(() => { setSwitching(false); setDetailCoach(null); })
      .catch(() => setError("تعذّر تعيين المدرب، حاول مرة أخرى"))
      .finally(() => setChoosingId(null));
  };

  // فتح قائمة المدربين لتغيير المدرب الحالي
  const handleStartSwitch = () => {
    setSwitching(true);
    dispatch(fetchAvailableCoachesThunk());
  };

  // إزالة المدرب الحالي
  const handleRemoveCoach = () => {
    setRemoving(true);
    setError("");
    dispatch(removeCoachThunk())
      .unwrap()
      .catch(() => setError("تعذّر إزالة المدرب، حاول مرة أخرى"))
      .finally(() => setRemoving(false));
  };

  // ── شاشة تأكيد الدفع ──
  if (confirming) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-40 text-center">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-brand-purple" />
        <p className="text-lg font-bold">جارٍ تأكيد اشتراكك...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-20 pt-28">
      {/* رأس الصفحة */}
      <div className="mb-10 text-center">
        <span className="mb-4 inline-block rounded-full border border-brand-purple/30 bg-brand-purple/10 px-4 py-1.5 text-xs font-bold text-brand-purple">
          💎 الباقة البريميوم
        </span>
        <h1 className="text-4xl font-black">
          {isPremium ? "أنت على البريميوم 🎉" : "أطلق إمكاناتك الكاملة"}
        </h1>
        <p className="mt-3 text-slate-400">
          {isPremium
            ? "استمتع بجميع مميزات المنصة بما فيها مدربك الشخصي"
            : "الفرق الوحيد بين المجاني والبريميوم: مدرب بشري حقيقي"}
        </p>
      </div>

      {/* تنبيهات */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-400">
          <AlertTriangle className="h-5 w-5 shrink-0" /> {error}
        </div>
      )}
      {canceled && !isPremium && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-400">
          تم إلغاء عملية الدفع — لم يتم خصم أي مبلغ. يمكنك المحاولة في أي وقت.
        </div>
      )}

      {/* قسم المدرب */}
      <div className={cn(
        "mb-8 rounded-2xl border p-6 transition-all",
        isPremium ? "border-brand-purple/30 bg-brand-purple/5" : "border-white/10 bg-white/5"
      )}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl text-xl",
              isPremium ? "bg-brand-purple/20" : "bg-white/10"
            )}>
              {isPremium ? "👨‍🏫" : <Lock className="h-5 w-5 text-slate-600" />}
            </div>
            <div>
              <p className="font-bold">المدرب البشري المخصص</p>
              <p className="text-xs text-slate-500">
                {isPremium ? "مُعيَّن لك حصرياً" : "متاح للبريميوم فقط"}
              </p>
            </div>
          </div>
          {isPremium && coach && (
            <span className="rounded-full bg-brand-purple/20 px-3 py-1 text-xs font-bold text-brand-purple">
              نشط ✓
            </span>
          )}
        </div>

        {!isPremium ? (
          // مقفول للمجاني
          <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
            <Lock className="mx-auto mb-2 h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-500">
              بعد الترقية ستختار مدربك من فريقنا مباشرة
            </p>
          </div>
        ) : coach && !switching ? (
          // المدرب المُختار — الملف الكامل
          <div className="rounded-xl border border-brand-purple/20 bg-brand-purple/10 p-4">
            <div className="flex items-start gap-4">
              <CoachAvatar src={coach.profileImage} name={coach.name} size={64} />
              <div className="flex-1">
                <p className="font-bold text-white">{coach.name}</p>
                <p className="text-sm text-slate-400">متخصص في: {coach.specialty}</p>
                <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                  {coach.yearsExperience != null && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300">⏳ {coach.yearsExperience} سنوات خبرة</span>
                  )}
                  {coach.clientCount != null && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300">👥 {coach.clientCount} متدرب</span>
                  )}
                  {(coach.certifications ?? []).map((c, i) => (
                    <span key={i} className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-slate-300">
                      <Award className="h-3 w-3" /> {c.typeOther || c.type}
                    </span>
                  ))}
                  {(!coach.certifications || coach.certifications.length === 0) && coach.certification && (
                    <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-slate-300">
                      <Award className="h-3 w-3" /> {coach.certification}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-emerald-400">● متصل الآن</p>
              </div>
            </div>
            {coach.bio && (
              <p className="mt-3 rounded-xl bg-bg/40 p-3 text-sm leading-relaxed text-slate-300">{coach.bio}</p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleStartSwitch}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" /> تغيير المدرب
              </button>
              <button
                onClick={handleRemoveCoach}
                disabled={removing}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/10 disabled:opacity-50"
              >
                {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />} إزالة
              </button>
            </div>
          </div>
        ) : (
          // اختيار / تغيير المدرب
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-300">
                {switching ? "اختر مدرباً جديداً 👇" : "اختر مدربك الشخصي 👇"}
              </p>
              {switching && coach && (
                <button onClick={() => setSwitching(false)} className="text-xs text-slate-500 hover:text-slate-300">
                  إلغاء
                </button>
              )}
            </div>
            {availableCoaches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">
                لا يوجد مدربون متاحون حالياً — سيتم تعيين مدرب لك قريباً
              </div>
            ) : (
              <div className="space-y-2">
                {availableCoaches.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setDetailCoach(c)}
                    className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-bg p-3 text-right transition-all hover:border-brand-purple/50 hover:bg-brand-purple/5"
                  >
                    <CoachAvatar src={c.profileImage} name={c.name} size={48} />
                    <div className="flex-1">
                      <p className="font-bold text-white">{c.name}</p>
                      <p className="text-xs text-slate-500">
                        متخصص في: {c.specialty}
                        {c.yearsExperience != null && ` · ${c.yearsExperience} سنوات خبرة`}
                        {c.clientCount != null && ` · 👥 ${c.clientCount} متدرب`}
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-purple/20 px-3 py-1 text-xs font-bold text-brand-purple">التفاصيل</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* قائمة المميزات */}
      <div className="mb-8 space-y-3">
        {PREMIUM_FEATURES.map(({ icon: Icon, label, desc, premium }) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-4 rounded-2xl border p-4",
              premium && !isPremium
                ? "border-white/5 bg-white/[0.02] opacity-60"
                : "border-white/10 bg-white/5"
            )}
          >
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              premium ? "bg-brand-purple/10" : "bg-accent/10"
            )}>
              {premium && !isPremium
                ? <Lock className="h-4 w-4 text-slate-600" />
                : <Icon className={cn("h-4 w-4", premium ? "text-brand-purple" : "text-accent")} />
              }
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
            <CheckCircle2 className={cn(
              "h-5 w-5 shrink-0",
              premium && !isPremium ? "text-slate-700" : "text-accent"
            )} />
          </div>
        ))}
      </div>

      {/* الترقية أو رسالة البريميوم */}
      {isPremium ? (
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-accent" />
          <p className="font-bold text-accent">أنت على الباقة البريميوم</p>
          <p className="mt-1 text-sm text-slate-400">استمتع بجميع المميزات بما فيها مدربك الشخصي</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-purple/20 bg-brand-purple/5 p-6">
          <p className="mb-4 text-center text-lg font-black">جاهز للترقية؟</p>

          {/* اختيار الباقة */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            {(Object.keys(PLANS) as Interval[]).map((key) => {
              const p = PLANS[key];
              const active = interval === key;
              return (
                <button
                  key={key}
                  onClick={() => setInterval(key)}
                  className={cn(
                    "relative rounded-2xl border p-4 text-center transition-all",
                    active
                      ? "border-brand-purple bg-brand-purple/10"
                      : "border-white/10 bg-bg hover:border-white/20"
                  )}
                >
                  {key === "annual" && (
                    <span className="absolute -top-2 right-3 rounded-full bg-brand-purple px-2 py-0.5 text-[10px] font-bold text-white">
                      الأوفر
                    </span>
                  )}
                  <p className="text-sm font-semibold text-slate-300">{p.label}</p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {p.price}<span className="text-sm font-normal text-slate-500">{p.per}</span>
                  </p>
                  {p.note && <p className="mt-1 text-xs text-accent">{p.note}</p>}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleUpgrade}
            disabled={checkoutLoading}
            className="btn-primary flex w-full items-center justify-center gap-2 text-center disabled:opacity-50"
          >
            {checkoutLoading
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : "ترقية الآن 💎"}
          </button>
          <p className="mt-3 text-center text-xs text-slate-500">
            الدفع آمن عبر Stripe — وضع تجريبي، استخدم البطاقة 4242 4242 4242 4242
          </p>
        </div>
      )}

      {/* Coach detail popup — opened from the picker, choose from inside it */}
      {detailCoach && (
        <CoachDetailModal
          coach={detailCoach}
          choosing={choosingId === detailCoach.id}
          onChoose={() => handleChooseCoach(detailCoach.id)}
          onClose={() => setDetailCoach(null)}
        />
      )}
    </div>
  );
}
