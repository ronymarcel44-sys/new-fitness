// src/pages/coach/CoachProfile.tsx
// The coach edits their own profile — bio, specialty, experience, certification,
// and a profile photo (uploaded from device, shrunk to ~256px, stored as base64).

import { useState, useRef, useEffect } from "react";
import { Camera, Save, Loader2, CheckCircle2, Plus, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { updateCoachProfileThunk } from "@/features/coach/coachSlice";
import { CoachAvatar } from "@/components/coach/CoachAvatar";
import { CERT_TYPES } from "@/lib/constants";
import type { CoachSpecialty } from "@/types";

const SPECIALTIES: CoachSpecialty[] = ["قوة عضلية", "تخسيس", "لياقة عامة"];

// One editable certificate row
type CertRow = { type: string; number: string; typeOther: string };
const emptyCert = (): CertRow => ({ type: CERT_TYPES[0], number: "", typeOther: "" });

// Shrink an image file to a small square-ish base64 data URL for storage
function resizeImage(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas context"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CoachProfile() {
  const dispatch = useAppDispatch();
  const me = useAppSelector((s) => s.coach.me);

  const [form, setForm] = useState({
    name: "", bio: "", specialty: SPECIALTIES[0] as string,
    yearsExperience: "",
  });
  const [certs, setCerts]   = useState<CertRow[]>([emptyCert()]);
  const [image, setImage]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Certificate row helpers
  const updateCert = (i: number, patch: Partial<CertRow>) =>
    setCerts((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addCert    = () => setCerts((rows) => [...rows, emptyCert()]);
  const removeCert = (i: number) => setCerts((rows) => rows.filter((_, idx) => idx !== i));
  const certComplete = (c: CertRow) =>
    c.number.trim() !== "" && (c.type !== "أخرى" || c.typeOther.trim() !== "");

  // Pre-fill once the coach profile loads
  useEffect(() => {
    if (me) {
      setForm({
        name:            me.name,
        bio:             me.bio ?? "",
        specialty:       me.specialty,
        yearsExperience: me.yearsExperience != null ? String(me.yearsExperience) : "",
      });
      setCerts(
        me.certifications && me.certifications.length > 0
          ? me.certifications.map((c) => ({ type: c.type, number: c.number, typeOther: c.typeOther ?? "" }))
          : [emptyCert()],
      );
      setImage(me.profileImage ?? null);
    }
  }, [me]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImage(await resizeImage(file));
    } catch {
      /* ignore bad image */
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await dispatch(updateCoachProfileThunk({
      ...form,
      certifications: certs.filter(certComplete).map((c) => ({
        type:   c.type,
        number: c.number.trim(),
        ...(c.type === "أخرى" && { typeOther: c.typeOther.trim() }),
      })),
      profileImage: image ?? "",
    }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Coach Portal</p>
        <h1 className="mt-1 text-2xl font-black">ملفي الشخصي</h1>
        <p className="mt-1 text-sm text-slate-500">هذه المعلومات يراها متدربوك</p>
      </div>

      <div className="card space-y-5">
        {/* الصورة */}
        <div className="flex items-center gap-4">
          <button onClick={() => fileRef.current?.click()} className="group relative">
            <CoachAvatar src={image} name={form.name || "؟"} size={80} />
            <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-6 w-6 text-white" />
            </span>
          </button>
          <div>
            <button onClick={() => fileRef.current?.click()} className="text-sm font-semibold text-brand-purple hover:underline">
              تغيير الصورة
            </button>
            <p className="mt-0.5 text-xs text-slate-500">JPG أو PNG — تُصغّر تلقائياً</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>

        {/* الاسم */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-400">الاسم</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-base" />
        </div>

        {/* التخصص + الخبرة */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">التخصص</label>
            <select value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className="input-base">
              {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">سنوات الخبرة</label>
            <input type="number" min="0" value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })} className="input-base" />
          </div>
        </div>

        {/* الشهادات */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-400">الشهادات / التراخيص</label>
          <p className="mb-2 text-[11px] text-slate-500">الرقم يُستخدم للتحقق فقط ولا يظهر للمتدربين.</p>

          <div className="space-y-2.5">
            {certs.map((c, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-bg/40 p-2.5">
                <div className="flex items-center gap-2">
                  <select value={c.type} onChange={(e) => updateCert(i, { type: e.target.value })} className="input-base w-32 shrink-0">
                    {CERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="text" value={c.number} onChange={(e) => updateCert(i, { number: e.target.value })}
                    placeholder="رقم الشهادة" className="input-base flex-1" />
                  {certs.length > 1 && (
                    <button type="button" onClick={() => removeCert(i)}
                      className="shrink-0 rounded-lg border border-white/10 p-2 text-slate-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                      aria-label="حذف الشهادة">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {c.type === "أخرى" && (
                  <input type="text" value={c.typeOther} onChange={(e) => updateCert(i, { typeOther: e.target.value })}
                    placeholder="اسم الشهادة (مثال: مدرب تغذية معتمد)" className="input-base mt-2" />
                )}
              </div>
            ))}
          </div>

          <button type="button" onClick={addCert}
            className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-accent transition-colors hover:text-accent/80">
            <Plus className="h-3.5 w-3.5" /> إضافة شهادة أخرى
          </button>
        </div>

        {/* النبذة */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-400">نبذة عنك</label>
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={4} className="input-base resize-none" placeholder="خبرتك، أسلوبك في التدريب، وما يميزك..." />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "تم الحفظ" : "حفظ التغييرات"}
        </button>
      </div>
    </div>
  );
}
