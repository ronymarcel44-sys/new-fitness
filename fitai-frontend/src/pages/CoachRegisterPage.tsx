// src/pages/CoachRegisterPage.tsx
//
// Public registration page for trainers. Calls POST /auth/register-coach.
// The account is created as "pending" — on success the coach is logged in and
// sent to /coach, where the layout shows an "under review" screen until an
// admin verifies and approves them.

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Dumbbell, Eye, EyeOff, Loader2, Plus, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { registerCoachThunk, clearError } from "@/features/auth/authSlice";
import { CERT_TYPES } from "@/lib/constants";
import type { CoachSpecialty } from "@/types";

const SPECIALTIES: CoachSpecialty[] = ["قوة عضلية", "تخسيس", "لياقة عامة"];

// One editable certificate row in the form
type CertRow = { type: string; number: string; typeOther: string };
const emptyCert = (): CertRow => ({ type: CERT_TYPES[0], number: "", typeOther: "" });

export function CoachRegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { isLoggedIn, role, error, isLoading } = useAppSelector((s) => s.auth);

  const [form, setForm] = useState({
    name: "", email: "", password: "", confirm: "",
    specialty: SPECIALTIES[0] as CoachSpecialty,
    bio: "", yearsExperience: "",
  });
  const [certs,      setCerts]      = useState<CertRow[]>([emptyCert()]);
  const [showPass,   setShowPass]   = useState(false);
  const [localError, setLocalError] = useState("");

  // Certificate row helpers
  const updateCert = (i: number, patch: Partial<CertRow>) =>
    setCerts((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addCert    = () => setCerts((rows) => [...rows, emptyCert()]);
  const removeCert = (i: number) => setCerts((rows) => rows.filter((_, idx) => idx !== i));

  // A row is complete when it has a number, plus a real name for the "أخرى" case
  const certComplete = (c: CertRow) =>
    c.number.trim() !== "" && (c.type !== "أخرى" || c.typeOther.trim() !== "");

  // After register succeeds (role becomes "coach") → go to the coach area
  useEffect(() => {
    if (isLoggedIn && role === "coach") navigate("/coach", { replace: true });
  }, [isLoggedIn, role, navigate]);

  useEffect(() => {
    return () => { dispatch(clearError()); };
  }, [dispatch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");

    if (!form.name.trim())              { setLocalError("الاسم مطلوب"); return; }
    if (form.password.length < 6)       { setLocalError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    if (form.password !== form.confirm) { setLocalError("كلمة المرور غير متطابقة"); return; }

    const validCerts = certs.filter(certComplete);
    if (validCerts.length === 0) { setLocalError("أضف شهادة واحدة على الأقل (النوع والرقم)"); return; }

    dispatch(registerCoachThunk({
      name:            form.name,
      email:           form.email,
      password:        form.password,
      specialty:       form.specialty,
      bio:             form.bio,
      yearsExperience: form.yearsExperience,
      certifications:  validCerts.map((c) => ({
        type:   c.type,
        number: c.number.trim(),
        ...(c.type === "أخرى" && { typeOther: c.typeOther.trim() }),
      })),
    }));
  };

  const displayError = localError || error;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      {/* Glow blobs */}
      <div className="pointer-events-none fixed right-1/4 top-1/4 h-80 w-80 rounded-full bg-brand-purple/10 blur-[100px]" />
      <div className="pointer-events-none fixed bottom-1/4 left-1/4 h-64 w-64 rounded-full bg-accent/10 blur-[100px]" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-hero shadow-accent-lg">
            <Dumbbell className="h-8 w-8 text-bg" />
          </div>
          <h1 className="text-3xl font-black">انضم كمدرب 💪</h1>
          <p className="mt-2 text-sm text-slate-500">سجّل بياناتك وسيراجعها فريقنا قبل التفعيل</p>
        </div>

        <div className="card border-white/10">
          <h2 className="mb-6 text-xl font-bold">إنشاء حساب مدرب</h2>

          {displayError && (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">الاسم الكامل</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="محمد أحمد" className="input-base" required autoComplete="name" />
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">البريد الإلكتروني</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="coach@example.com" className="input-base" required autoComplete="email" />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">كلمة المرور</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="6 أحرف على الأقل" className="input-base pl-12" required autoComplete="new-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">تأكيد كلمة المرور</label>
              <input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                placeholder="أعد كتابة كلمة المرور" className="input-base" required autoComplete="new-password" />
            </div>

            {/* Specialty */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">التخصص</label>
              <select value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value as CoachSpecialty })}
                className="input-base">
                {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Years of experience */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">سنوات الخبرة</label>
              <input type="number" min="0" value={form.yearsExperience}
                onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })}
                placeholder="مثال: 5" className="input-base" />
            </div>

            {/* Certificates — one or more (type + number) */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">الشهادات / التراخيص *</label>
              <p className="mb-2 text-[11px] text-slate-500">أضف شهاداتك المعتمدة — النوع ورقمها. الرقم يُستخدم للتحقق فقط ولا يظهر للمتدربين.</p>

              <div className="space-y-2.5">
                {certs.map((c, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-bg/40 p-2.5">
                    <div className="flex items-center gap-2">
                      <select
                        value={c.type}
                        onChange={(e) => updateCert(i, { type: e.target.value })}
                        className="input-base w-32 shrink-0"
                      >
                        {CERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        type="text" value={c.number}
                        onChange={(e) => updateCert(i, { number: e.target.value })}
                        placeholder="رقم الشهادة" className="input-base flex-1"
                      />
                      {certs.length > 1 && (
                        <button type="button" onClick={() => removeCert(i)}
                          className="shrink-0 rounded-lg border border-white/10 p-2 text-slate-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                          aria-label="حذف الشهادة">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {c.type === "أخرى" && (
                      <input
                        type="text" value={c.typeOther}
                        onChange={(e) => updateCert(i, { typeOther: e.target.value })}
                        placeholder="اسم الشهادة (مثال: مدرب تغذية معتمد)"
                        className="input-base mt-2"
                      />
                    )}
                  </div>
                ))}
              </div>

              <button type="button" onClick={addCert}
                className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-accent transition-colors hover:text-accent/80">
                <Plus className="h-3.5 w-3.5" /> إضافة شهادة أخرى
              </button>
            </div>

            {/* Bio */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">نبذة عنك</label>
              <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="خبرتك، تخصصك، وأسلوبك في التدريب..." rows={3} className="input-base resize-none" />
            </div>

            <button type="submit" disabled={isLoading}
              className="btn-primary mt-2 w-full text-center glow flex items-center justify-center gap-2 disabled:opacity-70">
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ إرسال الطلب...</>
              ) : "إرسال طلب الانضمام ←"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            لديك حساب بالفعل؟{" "}
            <Link to="/login" className="text-accent hover:underline">سجّل الدخول</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
