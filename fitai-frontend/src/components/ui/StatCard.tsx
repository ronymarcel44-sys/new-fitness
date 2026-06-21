// src/components/ui/StatCard.tsx

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  trend?: { value: number; label: string };
}

export function StatCard({ label, value, icon, color = "#00E5A0", trend }: StatCardProps) {
  const isPositive = trend && trend.value >= 0;
  return (
    <div className="bg-bg-card rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold" style={{ color }}>{value.toLocaleString()}</p>
      {trend && (
        <p className={`text-xs ${isPositive ? "text-green-400" : "text-red-400"}`}>
          {isPositive ? "▲" : "▼"} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  );
}
