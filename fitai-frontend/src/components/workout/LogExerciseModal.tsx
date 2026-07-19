// src/components/workout/LogExerciseModal.tsx
//
// NEW (Task 6) — required prompt when marking a strength/cardio exercise done:
// asks for the actual weight used (strength) or minutes completed (cardio).
// Shared across WorkoutPage, ExerciseDetailPage, and DashboardPage so all
// three entry points behave identically — see the project's "Known Bugs" note
// about toggleDoneThunk needing to be kept in sync across every call site.

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Exercise } from "@/types";

interface LogExerciseModalProps {
  exercise:  Exercise | null; // null = closed
  onConfirm: (value: number) => void;
  onClose:   () => void;
}

export function LogExerciseModal({ exercise, onConfirm, onClose }: LogExerciseModalProps) {
  const [value, setValue] = useState("");

  if (!exercise) return null;

  const isCardio = exercise.exerciseType === "cardio";
  const label    = isCardio ? "كم دقيقة أكملت؟" : "كم كان الوزن المستخدم؟ (كغ)";
  const num      = Number(value);
  const valid    = value.trim() !== "" && Number.isFinite(num) && num > 0;

  const close  = () => { setValue(""); onClose(); };
  const submit = () => {
    if (!valid) return;
    onConfirm(num);
    setValue("");
  };

  return (
    <Modal
      isOpen
      title={`تسجيل: ${exercise.name}`}
      onClose={close}
      footer={
        <>
          <button
            onClick={close}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-400 transition-all hover:text-white"
          >
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={!valid}
            className="rounded-xl border border-accent/30 bg-accent/15 px-4 py-2 text-sm font-bold text-accent transition-all hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            تسجيل وإنجاز ✓
          </button>
        </>
      }
    >
      <label className="mb-2 block text-sm text-slate-300">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder={isCardio ? "مثال: 25" : "مثال: 40"}
        className="input-base w-full"
        autoFocus
      />
      <p className="mt-2 text-xs text-slate-500">
        {isCardio
          ? "هذا الرقم مطلوب لتتبع تقدّمك في التحمل."
          : "هذا الرقم مطلوب لتتبع تقدّمك وأرقامك القصوى."}
      </p>
    </Modal>
  );
}
