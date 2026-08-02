// src/components/coach/CoachDetailModal.tsx
// A popup a premium user opens before choosing a coach, so they can review the
// coach's credentials — certificate types (numbers are never sent to users),
// years of experience, current client count, and bio — then choose explicitly.

import { X, Award, Loader2, Star, Users } from "lucide-react";
import { CoachAvatar } from "@/components/coach/CoachAvatar";
import type { AssignedCoach } from "@/types";

export function CoachDetailModal({
  coach, choosing, onChoose, onClose,
}: {
  coach: AssignedCoach;
  choosing: boolean;
  onChoose: () => void;
  onClose: () => void;
}) {
  const certs = coach.certifications ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-bg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute left-4 top-4 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4">
          <CoachAvatar src={coach.profileImage} name={coach.name} size={72} />
          <div>
            <p className="text-lg font-black text-white">{coach.name}</p>
            <p className="text-sm text-slate-400">متخصص في: {coach.specialty}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center">
            <Star className="mx-auto mb-1 h-4 w-4 text-brand-orange" />
            <p className="text-lg font-black text-white">{coach.yearsExperience ?? 0}</p>
            <p className="text-[11px] text-slate-500">سنوات الخبرة</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center">
            <Users className="mx-auto mb-1 h-4 w-4 text-brand-purple" />
            <p className="text-lg font-black text-white">{coach.clientCount ?? 0}</p>
            <p className="text-[11px] text-slate-500">متدرب حالياً</p>
          </div>
        </div>

        {/* Certificates — types only, no numbers */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-slate-400">الشهادات المعتمدة</p>
          {certs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {certs.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  <Award className="h-3.5 w-3.5" /> {c.typeOther || c.type}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">لا توجد شهادات مسجّلة</p>
          )}
        </div>

        {/* Bio */}
        {coach.bio && (
          <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm leading-relaxed text-slate-300">{coach.bio}</p>
        )}

        {/* Choose */}
        <button
          onClick={onChoose}
          disabled={choosing}
          className="btn-primary mt-5 flex w-full items-center justify-center gap-2 glow disabled:opacity-60"
        >
          {choosing ? <Loader2 className="h-4 w-4 animate-spin" /> : "اختيار هذا المدرب"}
        </button>
      </div>
    </div>
  );
}
