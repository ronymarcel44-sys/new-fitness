import { Card } from "@/components/ui/Card";
import { FEATURES } from "@/lib/constants";

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-28">
      <div className="mb-16 text-center">
        <p className="section-label mb-3">ما الذي يميّزنا</p>
        <h2 className="text-4xl font-black md:text-5xl">كل ما تحتاجه في مكان واحد</h2>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon, title, desc, color }) => (
          <Card key={title} hover>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl border text-2xl"
              style={{ background: `${color}18`, borderColor: `${color}40` }}>{icon}</div>
            <h3 className="mb-2 text-lg font-bold">{title}</h3>
            <p className="text-sm leading-relaxed text-slate-400">{desc}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
