import { useAppDispatch } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";

// Shown in place of the entire app when a logged-in user's account has been
// banned by an admin (profile.status === "disabled"). The user can still log in,
// but every screen is replaced by this one; the only action available is logout.
export function BannedScreen() {
  const dispatch = useAppDispatch();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center font-tajawal text-slate-100">
      <div className="max-w-md rounded-3xl border border-red-500/30 bg-red-500/5 p-10">
        <div className="mb-4 text-6xl">🚫</div>
        <h1 className="mb-3 text-2xl font-black text-red-400">تم حظر حسابك</h1>
        <p className="mb-8 text-sm leading-relaxed text-slate-400">
          تم حظر حسابك من قِبَل الإدارة، ولا يمكنك استخدام التطبيق حالياً. إذا كنت
          تعتقد أن هناك خطأً، فتواصل مع الإدارة.
        </p>
        <button
          onClick={() => dispatch(logout())}
          className="w-full rounded-xl border border-white/10 bg-bg-card py-3 text-sm font-bold text-slate-300 transition-all hover:border-white/20 hover:text-white"
        >
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
