// src/pages/coach/CoachEarnings.tsx
// Coach earnings dashboard (50% of each premium client's $10/mo plan = $5/client).
// Simulated money — withdrawals are recorded but no real transfer happens.

import { useState, useEffect } from "react";
import { Wallet, Users, TrendingUp, DollarSign, Loader2, ArrowDownToLine } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { fetchEarningsThunk, withdrawThunk } from "@/features/coach/coachSlice";
import { Modal } from "@/components/ui/Modal";

const METHOD_LABELS: Record<string, string> = {
  bank:   "تحويل بنكي",
  paypal: "PayPal",
  wallet: "محفظة إلكترونية",
};

export function CoachEarnings() {
  const dispatch = useAppDispatch();
  const earnings = useAppSelector((s) => s.coach.earnings);

  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount]       = useState("");
  const [method, setMethod]       = useState("bank");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    dispatch(fetchEarningsThunk());
  }, [dispatch]);

  if (!earnings) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  const openWithdraw = () => {
    setAmount(String(earnings.available));
    setMethod("bank");
    setError("");
    setModalOpen(true);
  };

  const handleWithdraw = async () => {
    const val = Number(amount);
    if (!val || val <= 0)            { setError("أدخل مبلغاً صحيحاً"); return; }
    if (val > earnings.available)    { setError("المبلغ أكبر من رصيدك المتاح"); return; }
    setSubmitting(true);
    setError("");
    await dispatch(withdrawThunk({ amount: val, method }));
    setSubmitting(false);
    setModalOpen(false);
  };

  return (
    <div>
      {/* رأس الصفحة */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Coach Portal</p>
        <h1 className="mt-1 text-2xl font-black">الأرباح 💰</h1>
        <p className="mt-1 text-sm text-slate-500">
          تحصل على {earnings.sharePct}% من اشتراك كل متدرب بريميوم (${earnings.perClient} لكل متدرب شهرياً)
        </p>
      </div>

      {/* بطاقات الملخص */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="mb-2 flex items-center gap-2"><DollarSign className="h-4 w-4 text-accent" /><p className="text-xs text-slate-500">أرباح هذا الشهر</p></div>
          <p className="text-3xl font-black text-accent">${earnings.monthlyEarnings}</p>
        </div>
        <div className="card">
          <div className="mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-brand-blue" /><p className="text-xs text-slate-500">متدربون مدفوعون</p></div>
          <p className="text-3xl font-black text-white">{earnings.clients.length}</p>
        </div>
        <div className="card">
          <div className="mb-2 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-brand-purple" /><p className="text-xs text-slate-500">متوقع سنوياً</p></div>
          <p className="text-3xl font-black text-white">${earnings.projectedYearly}</p>
        </div>
        <div className="card border-accent/30 bg-accent/5">
          <div className="mb-2 flex items-center gap-2"><Wallet className="h-4 w-4 text-accent" /><p className="text-xs text-slate-500">الرصيد المتاح</p></div>
          <p className="text-3xl font-black text-accent">${earnings.available}</p>
          <button
            onClick={openWithdraw}
            disabled={earnings.available <= 0}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent py-2 text-xs font-bold text-bg transition-all hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" /> سحب الأرباح
          </button>
        </div>
      </div>

      {/* قائمة المتدربين المدفوعين */}
      <div className="card mb-6">
        <h3 className="mb-4 font-bold">متدربوك المدفوعون 👥</h3>
        {earnings.clients.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">لا يوجد متدربون بريميوم بعد — أرباحك تبدأ عندما يختارك متدرب بريميوم</p>
        ) : (
          <div className="space-y-2">
            {earnings.clients.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-bg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 font-black text-accent">{c.name[0]}</div>
                  <span className="font-semibold text-white">{c.name}</span>
                </div>
                <span className="text-sm font-bold text-accent">+${c.amount} / شهر</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* سجل السحوبات */}
      <div className="card">
        <h3 className="mb-4 font-bold">سجل السحوبات 🧾</h3>
        {earnings.withdrawals.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">لم تقم بأي عملية سحب بعد</p>
        ) : (
          <div className="space-y-2">
            {earnings.withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-bg px-4 py-3">
                <div>
                  <p className="font-semibold text-white">${w.amount}</p>
                  <p className="text-xs text-slate-500">{METHOD_LABELS[w.method] ?? w.method}</p>
                </div>
                <span className="text-xs text-slate-500">{new Date(w.createdAt).toLocaleDateString("ar-EG")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* نافذة السحب */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="سحب الأرباح"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-xl bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10">إلغاء</button>
            <button onClick={handleWithdraw} disabled={submitting} className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-bg hover:bg-accent/80 disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />} تأكيد السحب
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3" dir="rtl">
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
          <p className="text-xs text-slate-500">الرصيد المتاح: <span className="font-bold text-accent">${earnings.available}</span></p>
          <div>
            <label className="mb-1 block text-xs text-slate-400">المبلغ ($)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-base w-full" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">طريقة السحب</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="input-base w-full">
              <option value="bank">تحويل بنكي</option>
              <option value="paypal">PayPal</option>
              <option value="wallet">محفظة إلكترونية</option>
            </select>
          </div>
          <p className="text-[11px] text-slate-600">ملاحظة: هذه محاكاة لأغراض العرض — لا يتم تحويل مبالغ حقيقية.</p>
        </div>
      </Modal>
    </div>
  );
}
