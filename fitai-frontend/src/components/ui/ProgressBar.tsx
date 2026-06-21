import { cn } from "@/lib/utils";

interface Props {
  label: string;
  current: number;
  target: number;
  unit: string;
  color?: string;
  className?: string;
}

export function ProgressBar({ label, current, target, unit, color = "bg-accent", className }: Props) {
  const pct = Math.min(target > 0 ? (current / target) * 100 : 0, 100);
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-accent">{current}{unit} / {target}{unit}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
