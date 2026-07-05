import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { HeroSection } from "@/components/sections/HeroSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";

const TRUST = [
  { val: "+500",   sub: "مستخدم",        color: "#00E5A0" },
  { val: "7 أيام", sub: "مجاناً",         color: "#3B82F6" },
  { val: "عربي",   sub: "واجهة كاملة",   color: "#A855F7" },
];

export function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />

      {/* CTA Section */}
      <section
        className="relative overflow-hidden px-6 py-24"
        style={{ background: "#0a0e1a", direction: "rtl", fontFamily: "Tajawal, Arial, sans-serif" }}
      >
        {/* Radial glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="h-72 w-[500px] rounded-full"
            style={{ background: "radial-gradient(ellipse, rgba(0,229,160,0.06), transparent 70%)" }}
          />
        </div>

        {/* Beam from top */}
        <motion.div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{
            width: 1, height: 100,
            background: "linear-gradient(180deg, rgba(0,229,160,0.6), transparent)",
            boxShadow: "0 0 20px rgba(0,229,160,0.25)",
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="relative mx-auto max-w-xl text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Icon */}
          <motion.div
            className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl"
            style={{ background: "rgba(0,229,160,0.08)", borderColor: "rgba(0,229,160,0.25)" }}
            animate={{
              boxShadow: [
                "0 0 0px rgba(0,229,160,0)",
                "0 0 22px rgba(0,229,160,0.3)",
                "0 0 0px rgba(0,229,160,0)",
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            ⚡
          </motion.div>

          <h2 className="mb-4 text-4xl font-black leading-tight text-white sm:text-5xl">
            ابدأ رحلتك اليوم
            <br />
            <span
              style={{
                background: "linear-gradient(135deg,#00E5A0,#3B82F6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              مجاناً بدون بطاقة
            </span>
          </h2>

          <p className="mb-9 text-base leading-relaxed" style={{ color: "#64748b" }}>
            خطتك الأولى جاهزة في أقل من دقيقتين — ما تحتاج خبرة مسبقة
          </p>

          {/* CTA button */}
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/login"
              className="inline-block rounded-2xl px-12 py-5 text-lg font-black"
              style={{
                background: "linear-gradient(135deg, #00E5A0, #00c987)",
                color: "#0a0e1a",
                boxShadow: "0 0 35px rgba(0,229,160,0.4), 0 0 70px rgba(0,229,160,0.15)",
              }}
            >
              ابدأ مجاناً الآن ←
            </Link>
          </motion.div>

          <p className="mt-4 text-sm" style={{ color: "#475569" }}>
            لا يوجد التزام · يمكنك الإلغاء في أي وقت
          </p>

          {/* Trust bar */}
          <div
            className="mt-10 flex justify-center gap-10 border-t pt-7"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            {TRUST.map(({ val, sub, color }) => (
              <div key={sub} className="text-center">
                <div className="text-2xl font-black" style={{ color }}>{val}</div>
                <div className="mt-1 text-xs" style={{ color: "#475569" }}>{sub}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>
    </>
  );
}
