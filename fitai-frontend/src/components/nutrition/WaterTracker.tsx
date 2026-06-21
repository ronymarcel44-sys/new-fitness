import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { addWater, removeWater } from "@/features/nutrition/nutritionSlice";

export function WaterTracker() {
  const dispatch = useAppDispatch();
  const waterIntake = useAppSelector((s) => s.nutrition.waterIntake);
  const profile     = useAppSelector((s) => s.user.profile);

  const weight = parseFloat(profile?.weight ?? "0");
  const target = weight > 0 ? Math.round((weight * 35) / 250) : 8;

  const [custom, setCustom] = useState("");

  const pct     = Math.min((waterIntake / target) * 100, 100);
  const reached = waterIntake >= target;

  const handleCustomAdd = () => {
    const n = parseInt(custom, 10);
    if (n > 0) {
      dispatch(addWater(n));
      setCustom("");
    }
  };

  return (
    <Card className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">الماء 💧</h3>
        <span className={`text-sm font-semibold ${reached ? "text-accent" : "text-brand-blue"}`}>
          {waterIntake} / {target} أكواب
        </span>
      </div>

      <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-300 ${reached ? "bg-accent" : "bg-brand-blue"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => dispatch(addWater(1))} className="btn-secondary px-4 text-sm">
          +1 كوب
        </button>
        <button onClick={() => dispatch(addWater(2))} className="btn-secondary px-4 text-sm">
          +2 كوب
        </button>
        <button
          onClick={() => dispatch(removeWater())}
          disabled={waterIntake === 0}
          className="btn-secondary px-4 text-sm disabled:opacity-40"
        >
          −1
        </button>
        <div className="flex min-w-0 flex-1 gap-2">
          <input
            type="number"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCustomAdd()}
            placeholder="عدد مخصص"
            min="1"
            className="input-base flex-1 text-sm"
          />
          <button
            onClick={handleCustomAdd}
            disabled={!custom || parseInt(custom, 10) <= 0}
            className="btn-primary shrink-0 px-4 text-sm disabled:opacity-50"
          >
            إضافة
          </button>
        </div>
      </div>

      {reached && (
        <p className="mt-3 text-center text-xs text-accent">🎉 أكملت هدفك المائي اليوم!</p>
      )}
    </Card>
  );
}
