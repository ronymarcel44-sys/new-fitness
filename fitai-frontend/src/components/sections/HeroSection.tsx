import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { STATS } from "@/lib/constants";

const PHOTO =
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1400&q=80&auto=format&fit=crop&crop=center";

const PARTICLES: { top: string; left: string; size: number; color: string; delay: number }[] = [
  { top: "20%", left: "30%", size: 3, color: "#00E5A0", delay: 0 },
  { top: "46%", left: "22%", size: 2, color: "#3B82F6", delay: 1.2 },
  { top: "67%", left: "38%", size: 2, color: "#A855F7", delay: 0.7 },
];

const STAT_COLORS = ["#00E5A0", "#3B82F6", "#A855F7", "#FF6B35"];

export function HeroSection() {
  return (
    <section
      className="relative min-h-screen overflow-hidden bg-black"
      style={{ direction: "rtl", fontFamily: "Tajawal, Arial, sans-serif" }}
    >
      {/* Photo */}
      <img
        src={PHOTO}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        style={{ opacity: 0.32 }}
      />

      {/* Gradient overlay — right side dark for text */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(10,14,26,0.38) 30%, rgba(10,14,26,0.93) 58%, #0a0e1a 100%)",
        }}
      />

      {/* HUD — top-left corner of scan frame */}
      <motion.div
        className="absolute"
        style={{
          top: "10%", left: "4%", width: 28, height: 28,
          borderTop: "1.5px solid rgba(0,229,160,0.6)",
          borderRight: "1.5px solid rgba(0,229,160,0.6)",
          borderRadius: "0 3px 0 0",
        }}
        initial={{ opacity: 0, x: -10, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      />
      {/* HUD — top-right corner of scan frame */}
      <motion.div
        className="absolute"
        style={{
          top: "10%", left: "44%", width: 28, height: 28,
          borderTop: "1.5px solid rgba(0,229,160,0.6)",
          borderLeft: "1.5px solid rgba(0,229,160,0.6)",
          borderRadius: "3px 0 0 0",
        }}
        initial={{ opacity: 0, x: 10, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      />
      {/* HUD — bottom-left corner */}
      <motion.div
        className="absolute"
        style={{
          bottom: "10%", left: "4%", width: 28, height: 28,
          borderBottom: "1.5px solid rgba(0,229,160,0.6)",
          borderRight: "1.5px solid rgba(0,229,160,0.6)",
          borderRadius: "0 0 0 3px",
        }}
        initial={{ opacity: 0, x: -10, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      />
      {/* HUD — bottom-right corner */}
      <motion.div
        className="absolute"
        style={{
          bottom: "10%", left: "44%", width: 28, height: 28,
          borderBottom: "1.5px solid rgba(0,229,160,0.6)",
          borderLeft: "1.5px solid rgba(0,229,160,0.6)",
          borderRadius: "0 0 3px 0",
        }}
        initial={{ opacity: 0, x: 10, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      />

      {/* Scan lines */}
      <div className="absolute" style={{ top: "28%", left: "4%", width: "40%", height: 1, background: "linear-gradient(90deg, transparent, rgba(0,229,160,0.35), rgba(0,229,160,0.1), transparent)" }} />
      <div className="absolute" style={{ top: "50%", left: "4%", width: "38%", height: 1, background: "linear-gradient(90deg, transparent, rgba(0,229,160,0.25), transparent)" }} />
      <div className="absolute" style={{ top: "72%", left: "4%", width: "36%", height: 1, background: "linear-gradient(90deg, transparent, rgba(0,229,160,0.2), transparent)" }} />

      {/* Cinematic beam */}
      <motion.div
        className="absolute"
        style={{
          top: 0, right: "35%", width: 1, height: "58%",
          background: "linear-gradient(180deg, rgba(0,229,160,0.8), transparent)",
          boxShadow: "0 0 25px rgba(0,229,160,0.3), 0 0 50px rgba(0,229,160,0.1)",
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Particles */}
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
          animate={{ y: [-4, 4, -4], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3 + p.delay, repeat: Infinity, ease: "easeInOut", delay: p.delay }}
        />
      ))}

      {/* Text content */}
      <div
        className="relative z-10 flex min-h-screen flex-col justify-center px-11 py-14"
        style={{ maxWidth: 490, marginRight: "auto" }}
      >
        {/* Badge */}
        <motion.div
          className="mb-7 inline-flex items-center gap-2 self-start rounded-full border px-4 py-1.5"
          style={{ background: "rgba(0,229,160,0.05)", borderColor: "rgba(0,229,160,0.22)" }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#00E5A0", boxShadow: "0 0 8px #00E5A0" }}
          />
          <span className="text-xs font-semibold" style={{ color: "#00E5A0" }}>
            مدرّبك الذكي · مدعوم بالـ AI
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="mb-5 text-5xl font-black leading-tight text-white"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
        >
          مدرّب يفهم جسمك
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #00E5A0 20%, #3B82F6 80%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ويتطور معك
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          className="mb-9 text-sm leading-relaxed"
          style={{ color: "#64748b", maxWidth: 360 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          ذكاء اصطناعي يبني لك برنامج تمارين وتغذية مخصص — ويعدّله كل أسبوع بناءً على نتائجك الحقيقية.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          className="mb-11 flex flex-wrap gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
        >
          <Link
            to="/login"
            className="rounded-xl px-8 py-3.5 text-sm font-black"
            style={{
              background: "linear-gradient(135deg, #00E5A0, #00c987)",
              color: "#0a0e1a",
              boxShadow: "0 0 28px rgba(0,229,160,0.35), 0 0 55px rgba(0,229,160,0.12)",
            }}
          >
            ابدأ مجاناً ←
          </Link>
          <button
            className="rounded-xl border px-7 py-3.5 text-sm font-medium"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
          >
            شوف كيف يشتغل
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="flex flex-wrap gap-7"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          {STATS.map(({ num, label }, i) => (
            <div key={label}>
              <div className="text-xl font-black" style={{ color: STAT_COLORS[i % 4] }}>
                {num}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: "#475569" }}>{label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-center">
        <motion.div
          className="mx-auto mb-1 flex items-start justify-center rounded-full border pt-1"
          style={{ width: 18, height: 28, borderColor: "rgba(255,255,255,0.12)" }}
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className="rounded-sm"
            style={{ width: 3, height: 6, background: "#00E5A0", opacity: 0.65 }}
          />
        </motion.div>
      </div>
    </section>
  );
}
