// src/pages/RegisterPage.tsx
//
// Real registration page — calls POST /auth/register on the backend.
// On success the user is immediately logged in and redirected to /chat
// so they can create their first AI plan right away.

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Zap, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { registerThunk, clearError } from "@/features/auth/authSlice";

export function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { isLoggedIn, error, isLoading } = useAppSelector((s) => s.auth);

  const [form,      setForm]      = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPass,  setShowPass]  = useState(false);
  const [localError,setLocalError]= useState(""); // client-side validation only

  // After register succeeds, redirect to /chat to start AI onboarding
  useEffect(() => {
    if (isLoggedIn) navigate("/chat", { replace: true });
  }, [isLoggedIn, navigate]);

  // Clear backend error when leaving the page
  useEffect(() => {
    return () => { dispatch(clearError()); };
  }, [dispatch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");

    // Client-side validation before hitting the backend
    if (!form.name.trim()) {
      setLocalError("الاسم مطلوب");
      return;
    }
    if (form.password.length < 6) {
      setLocalError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (form.password !== form.confirm) {
      setLocalError("كلمة المرور غير متطابقة");
      return;
    }

    // All valid — call the real backend
    dispatch(registerThunk({ name: form.name, email: form.email, password: form.password }));
  };

  // Show client-side error first, fall back to backend error
  const displayError = localError || error;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {/* Glow blobs */}
      <div className="pointer-events-none fixed right-1/4 top-1/4 h-80 w-80 rounded-full bg-accent/10 blur-[100px]" />
      <div className="pointer-events-none fixed bottom-1/4 left-1/4 h-64 w-64 rounded-full bg-brand-purple/10 blur-[100px]" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-hero shadow-accent-lg">
            <Zap className="h-8 w-8 text-bg" />
          </div>
          <h1 className="text-3xl font-black">فِيت<span className="text-accent">AI</span></h1>
          <p className="mt-2 text-sm text-slate-500">ابدأ رحلتك الرياضية الآن</p>
        </div>

        <div className="card border-white/10">
          <h2 className="mb-6 text-xl font-bold">إنشاء حساب جديد</h2>

          {/* Error message */}
          {displayError && (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">الاسم الكامل</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="محمد أحمد"
                className="input-base"
                required
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">البريد الإلكتروني</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="sara@example.com"
                className="input-base"
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="6 أحرف على الأقل"
                  className="input-base pl-12"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">تأكيد كلمة المرور</label>
              <input
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                placeholder="أعد كتابة كلمة المرور"
                className="input-base"
                required
                autoComplete="new-password"
              />
            </div>

            {/* Submit button with loading spinner */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary mt-2 w-full text-center glow flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جارٍ إنشاء الحساب...
                </>
              ) : (
                "إنشاء الحساب ←"
              )}
            </button>
          </form>

          {/* Link back to login */}
          <p className="mt-5 text-center text-xs text-slate-500">
            لديك حساب بالفعل؟{" "}
            <Link to="/login" className="text-accent hover:underline">
              سجّل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}