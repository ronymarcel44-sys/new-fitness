import { Card } from "@/components/ui/Card";
import { useAppSelector } from "@/app/hooks";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ReferenceLine, ResponsiveContainer, Tooltip,
} from "recharts";

export function WeeklyNutritionSummary() {
  const { plan, dailyLog, history } = useAppSelector((s) => s.nutrition);

  if (!plan) return null;

  const todayStr = new Date().toISOString().slice(0, 10);

  // Build a 7-entry array: 6 days ago → today
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr  = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString("ar-SA", { weekday: "short" });

    const meals =
      dateStr === todayStr
        ? dailyLog
        : (history.find((h) => h.date === dateStr)?.meals ?? []);

    const calories = meals.reduce((s, m) => s + m.calories, 0);
    const protein  = meals.reduce((s, m) => s + m.protein,  0);
    const carbs    = meals.reduce((s, m) => s + m.carbs,    0);
    const fat      = meals.reduce((s, m) => s + m.fat,      0);

    return { date: dateStr, day: dayLabel, calories, protein, carbs, fat, hasData: meals.length > 0 };
  });

  const avgCalories = Math.round(chartData.reduce((s, d) => s + d.calories, 0) / 7);
  const avgProtein  = Math.round(chartData.reduce((s, d) => s + d.protein,  0) / 7);
  const avgCarbs    = Math.round(chartData.reduce((s, d) => s + d.carbs,    0) / 7);
  const avgFat      = Math.round(chartData.reduce((s, d) => s + d.fat,      0) / 7);

  return (
    <div>
      {/* Bar chart */}
      <Card className="mb-6">
        <h3 className="mb-4 font-bold">السعرات — آخر 7 أيام 📊</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="day"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#1e293b",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value: number) => [`${value} kcal`, "السعرات"]}
            />
            <ReferenceLine
              y={plan.totalCalories}
              stroke="#F97316"
              strokeDasharray="4 4"
              label={{ value: "الهدف", fill: "#F97316", fontSize: 10, position: "insideTopRight" }}
            />
            <Bar dataKey="calories" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Per-day hit/miss indicators */}
      <Card className="mb-6">
        <h3 className="mb-3 font-bold">أيام الأسبوع</h3>
        <div className="flex justify-between">
          {chartData.map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <span className="text-xs text-slate-500">{d.day}</span>
              <span className={`text-lg font-bold ${d.hasData ? "text-accent" : "text-slate-700"}`}>
                {d.hasData ? "✓" : "✗"}
              </span>
              <span className="text-xs text-slate-600">
                {d.calories > 0 ? `${d.calories}` : "—"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Weekly averages */}
      <Card className="mb-6">
        <h3 className="mb-3 font-bold">متوسط الأسبوع</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "سعرات", val: avgCalories, unit: "kcal", color: "text-brand-orange"  },
            { label: "بروتين", val: avgProtein,  unit: "g",    color: "text-accent"        },
            { label: "كارب",   val: avgCarbs,    unit: "g",    color: "text-brand-blue"    },
            { label: "دهون",   val: avgFat,      unit: "g",    color: "text-brand-purple"  },
          ].map(({ label, val, unit, color }) => (
            <div key={label} className="rounded-xl bg-bg p-3 text-center">
              <div className={`text-xl font-black ${color}`}>{val}</div>
              <div className="text-xs text-slate-600">{unit}</div>
              <div className="mt-0.5 text-xs text-slate-500">{label}/يوم</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
