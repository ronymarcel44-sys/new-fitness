// src/components/goal/CelebrationToast.tsx
//
// Renders the head of the celebration queue as a toast that slides down from
// the top-center and auto-dismisses. Mounted once, globally, in AppLayout.

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { dismissCelebration } from "@/features/celebration/celebrationSlice";

export function CelebrationToast() {
  const dispatch = useAppDispatch();
  const current  = useAppSelector((s) => s.celebration.queue[0]);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => dispatch(dismissCelebration()), 4500);
    return () => clearTimeout(t);
  }, [current, dispatch]);

  if (!current) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[100] flex justify-center px-4">
      <div
        key={current.id}
        onClick={() => dispatch(dismissCelebration())}
        className="animate-celebrate pointer-events-auto flex cursor-pointer items-center gap-3 rounded-2xl border border-brand-orange/40 bg-bg-card/95 px-5 py-3.5 shadow-2xl backdrop-blur"
      >
        <span className="text-3xl">{current.emoji}</span>
        <div>
          <p className="font-black text-brand-orange">{current.title}</p>
          <p className="text-sm text-slate-300">{current.message}</p>
        </div>
      </div>
    </div>
  );
}
