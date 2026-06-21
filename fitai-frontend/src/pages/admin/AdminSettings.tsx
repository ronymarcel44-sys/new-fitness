// src/pages/admin/AdminSettings.tsx

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { updateAISettingsThunk } from "@/features/admin/adminSlice";

export function AdminSettings() {
  const dispatch = useAppDispatch();
  const { aiSettings } = useAppSelector((s) => s.admin);

  const [form, setForm] = useState(aiSettings);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    dispatch(updateAISettingsThunk(form));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => setForm(aiSettings);

  return (
    <div className="flex flex-col gap-6 max-w-3xl" dir="rtl">
      <div>
        <h1 className="text-3xl font-black text-white">إعدادات الذكاء الاصطناعي</h1>
        <p className="text-slate-400 mt-1">تحكم في سلوك الـ AI وأداءه</p>
      </div>

      {/* Model config */}
      <div className="bg-bg-card rounded-2xl border border-white/5 p-6 flex flex-col gap-5">
        <h2 className="font-bold text-white border-b border-white/10 pb-3">إعدادات النموذج</h2>

        <div>
          <label className="text-sm text-slate-400 mb-2 block">النموذج المستخدم</label>
          <input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            className="w-full bg-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent/50" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">
              الحد الأقصى للـ Tokens
              <span className="text-accent font-bold mr-2">{form.maxTokens.toLocaleString()}</span>
            </label>
            <input type="range" min={500} max={8000} step={500} value={form.maxTokens}
              onChange={(e) => setForm((f) => ({ ...f, maxTokens: Number(e.target.value) }))}
              className="w-full accent-accent" />
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>500</span><span>8000</span>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">
              درجة الإبداعية (Temperature)
              <span className="text-accent font-bold mr-2">{form.temperature.toFixed(1)}</span>
            </label>
            <input type="range" min={0} max={1} step={0.1} value={form.temperature}
              onChange={(e) => setForm((f) => ({ ...f, temperature: Number(e.target.value) }))}
              className="w-full accent-accent" />
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>دقيق 0</span><span>إبداعي 1</span>
            </div>
          </div>
        </div>

        {/* Temperature hint */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-400">
          💡 القيم المنخفضة (0.2-0.4) تعطي ردوداً أكثر اتساقاً. القيم العالية (0.7-0.9) تعطي تنوعاً أكثر.
        </div>
      </div>

      {/* System Prompt */}
      <div className="bg-bg-card rounded-2xl border border-white/5 p-6 flex flex-col gap-4">
        <h2 className="font-bold text-white border-b border-white/10 pb-3">System Prompt</h2>
        <p className="text-xs text-slate-500">هذا النص يُرسل للـ AI قبل كل محادثة ليحدد شخصيته وسلوكه.</p>
        <textarea
          value={form.systemPrompt}
          onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
          rows={10}
          className="w-full bg-bg border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-accent/50 resize-y leading-relaxed"
          placeholder="اكتب تعليمات النظام هنا..."
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>{form.systemPrompt.length} حرف</span>
          <span>~{Math.round(form.systemPrompt.length / 4)} token</span>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button onClick={handleSave}
          className="bg-accent hover:bg-accent/80 text-bg font-black px-6 py-3 rounded-xl text-sm transition-all">
          {saved ? "✅ تم الحفظ!" : "💾 حفظ الإعدادات"}
        </button>
        <button onClick={handleReset} className="text-slate-400 hover:text-white text-sm transition-colors">
          إعادة تعيين
        </button>
        {saved && <p className="text-green-400 text-sm animate-pulse">تم تطبيق الإعدادات بنجاح</p>}
      </div>
    </div>
  );
}
