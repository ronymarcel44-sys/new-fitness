import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { STATS } from "@/lib/constants";

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-24 pt-32 text-center">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div className="pointer-events-none absolute right-1/4 top-1/4 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-1/4 left-1/4 h-80 w-80 rounded-full bg-brand-orange/10 blur-[100px]" />

      <div className="relative z-10 flex flex-col items-center">
        <Badge className="mb-8">مدرّبك الذكي متاح الآن</Badge>
        <h1 className="mb-6 max-w-4xl text-5xl font-black leading-tight md:text-7xl">
          مدرّبك الشخصي<br />
          <span className="gradient-text">المدعوم بالذكاء</span><br />
          الاصطناعي
        </h1>
        <p className="mb-12 max-w-xl text-lg leading-relaxed text-slate-400">
          برامج تمارين وتغذية مخصصة لجسمك وأهدافك، مع متابعة يومية وتعديل تلقائي.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/login" className="btn-primary flex items-center gap-2 glow-lg text-base">
            ابدأ مجاناً الآن <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-20 flex flex-wrap justify-center gap-12">
          {STATS.map(({ num, label }) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-black text-accent">{num}</div>
              <div className="mt-1 text-sm text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
