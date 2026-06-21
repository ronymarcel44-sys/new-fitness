import { Link } from "react-router-dom";
import { HeroSection } from "@/components/sections/HeroSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";

export function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-2xl rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/10 to-brand-blue/10 px-8 py-20 text-center shadow-accent">
          <h2 className="mb-4 text-4xl font-black">جاهز تبدأ رحلتك؟</h2>
          <p className="mb-10 text-lg text-slate-400">سجّل دخولك والـ AI سيبني خطتك من الصفر</p>
          <Link to="/login" className="btn-primary inline-flex items-center gap-2 glow-lg text-base">
            ابدأ مجاناً الآن ←
          </Link>
        </div>
      </section>
    </>
  );
}
