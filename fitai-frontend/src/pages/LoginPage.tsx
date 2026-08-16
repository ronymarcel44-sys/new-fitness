// src/pages/LoginPage.tsx
//
// Changes from Phase 2:
// - "اسم المستخدم" field replaced with "البريد الإلكتروني" (backend uses email)
// - dispatch(login(...)) replaced with dispatch(loginThunk(...))
// - Button shows a spinner while the request is in-flight
// - Coach redirect added (role === "coach" → /coach)
// - Demo hints updated to show email addresses

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Zap, Eye, EyeOff, ShieldCheck, Loader2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { loginThunk, clearError } from "@/features/auth/authSlice";

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { isLoggedIn, role, error, isLoading } = useAppSelector((s) => s.auth);

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // After login succeeds, redirect based on role
  useEffect(() => {
    if (!isLoggedIn) return;
    if (role === "admin")      navigate("/admin",     { replace: true });
    else if (role === "coach") navigate("/coach",     { replace: true });
    else                       navigate("/dashboard", { replace: true });
  }, [isLoggedIn, role, navigate]);

  // Clear the error message when leaving this page
  useEffect(() => {
    return () => { dispatch(clearError()); };
  }, [dispatch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(loginThunk({ email, password }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {/* Glow blobs */}
      <div className="pointer-events-none fixed right-1/4 top-1/4 h-80 w-80 rounded-full bg-accent/10 blur-[100px]" />
      <div className="pointer-events-none fixed bottom-1/4 left-1/4 h-64 w-64 rounded-full bg-brand-blue/10 blur-[100px]" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-hero shadow-accent-lg">
            <Zap className="h-8 w-8 text-bg" />
          </div>
          <h1 className="text-3xl font-black">فِيت<span className="text-accent">AI</span></h1>
          <p className="mt-2 text-sm text-slate-500">مدرّبك الشخصي الذكي</p>
        </div>

        {/* Card */}
        <div className="card border-white/10">
          <h2 className="mb-6 text-xl font-bold">تسجيل الدخول</h2>

          {/* Error message from the backend */}
          {error && (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field — replaces the old username field */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sara@example.com"
                className="input-base"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="input-base pl-12"
                  required
                  autoComplete="current-password"
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

            {/* Button shows spinner while request is running */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary mt-2 w-full text-center glow flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جارٍ الدخول...
                </>
              ) : (
                "دخول ←"
              )}
            </button>
          </form>

          {/* Link to registration */}
          <p className="mt-4 text-center text-xs text-slate-500">
            ليس لديك حساب؟{" "}
            <Link to="/register" className="text-accent hover:underline">
              سجّل الآن مجاناً
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-slate-500">
            هل أنت مدرب؟{" "}
            <Link to="/coach/register" className="text-brand-orange hover:underline">
              سجّل كمدرب
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          <Link to="/" className="hover:text-slate-400">← العودة للرئيسية</Link>
        </p>
      </div>
    </div>
  );
}