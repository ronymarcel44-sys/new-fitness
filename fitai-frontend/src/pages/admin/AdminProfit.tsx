import { useState, useEffect } from "react";
import { Loader2, Download } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { format } from "date-fns";

export function AdminProfit() {
  const [start, setStart] = useState<string>(() => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - 29); d.setUTCHours(0,0,0,0); return d.toISOString().slice(0,10);
  });
  const [end, setEnd] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [rows, setRows] = useState<any[] | null>(null);
  const [totals, setTotals] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchReport(); }, []);

  async function fetchReport() {
    try {
      setLoading(true);
      const data = await apiRequest<any>("GET", `/admin/profit?start=${start}&end=${end}`);
      setRows(data.rows);
      setTotals(data.totals);
    } catch (err) {
      console.error(err);
      setRows([]);
      setTotals(null);
    } finally { setLoading(false); }
  }

  function downloadCSV() {
    if (!rows) return;
    const header = ["date","subscriptionsCount","grossRevenue","stripeFees","refunds","netProfit","coachShare","adminShare"];
    const csv = [header.join(",")].concat(rows.map(r => header.map(h => String(r[h] ?? "")).join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit_${start}_to_${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Admin</p>
        <h1 className="mt-1 text-2xl font-black">تقارير الأرباح</h1>
        <p className="mt-1 text-sm text-slate-500">عرض الربح لصافي الاشتراكات — الفترة: آخر 30 يوم افتراضياً</p>
      </div>

      <div className="mb-4 flex gap-2">
        <div>
          <label className="text-xs text-slate-400">من</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input-base ml-2" />
        </div>
        <div>
          <label className="text-xs text-slate-400">إلى</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input-base ml-2" />
        </div>
        <button onClick={fetchReport} className="rounded-xl bg-accent px-3 py-2 text-sm font-bold text-bg">تحديث</button>
        <button onClick={downloadCSV} disabled={!rows} className="ml-auto flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
          <Download className="h-4 w-4" /> تصدير CSV
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      ) : (
        <div>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="card">
              <p className="text-xs text-slate-500">اشتراكات</p>
              <p className="text-2xl font-black text-accent">{totals?.subscriptionsCount ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">إجمالي الإيراد</p>
              <p className="text-2xl font-black text-accent">${totals?.grossRevenue ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">صافي الربح</p>
              <p className="text-2xl font-black text-accent">${totals?.netProfit ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">رسم Stripe</p>
              <p className="text-2xl font-black text-accent">${totals?.stripeFees ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">حصة المدربين</p>
              <p className="text-2xl font-black text-accent">${totals?.coachShare ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">حصة الأدمن</p>
              <p className="text-2xl font-black text-accent">${totals?.adminShare ?? 0}</p>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-4 font-bold">تفاصيل يومية</h3>
            {rows && rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">لا بيانات لهذه الفترة</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed" style={{ minWidth: 800 }}>
                  <colgroup>
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <thead>
                    <tr className="text-right text-xs text-slate-500">
                      <th className="pb-2">التاريخ</th>
                      <th className="pb-2">اشتراكات</th>
                      <th className="pb-2">إيراد</th>
                      <th className="pb-2">رسوم</th>
                      <th className="pb-2">صافي الربح</th>
                      <th className="pb-2">حصة المدرب</th>
                      <th className="pb-2">حصة الأدمن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows && rows.map((r) => (
                      <tr key={r.date} className="border-t border-white/5">
                        <td className="py-3 text-sm">{r.date}</td>
                        <td className="py-3 text-sm text-right">{r.subscriptionsCount}</td>
                        <td className="py-3 text-sm text-right">${r.grossRevenue}</td>
                        <td className="py-3 text-sm text-right">${r.stripeFees}</td>
                        <td className="py-3 text-sm text-right">${r.netProfit}</td>
                        <td className="py-3 text-sm text-right">${r.coachShare}</td>
                        <td className="py-3 text-sm text-right">${r.adminShare}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminProfit;
