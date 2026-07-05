import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { STATS } from "@/lib/constants";

const PHOTO =
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1600&q=80&auto=format&fit=crop&crop=center";

const STAT_COLORS = ["#00E5A0", "#3B82F6", "#A855F7", "#FF6B35"];

/* Floating particles drifting over the photo side */
const PARTICLES: { top: string; left: string; size: number; color: string; delay: number; dur: number }[] = [
  { top: "18%", left: "12%", size: 4, color: "#00E5A0", delay: 0.0, dur: 5 },
  { top: "32%", left: "26%", size: 2, color: "#3B82F6", delay: 1.2, dur: 6 },
  { top: "44%", left: "8%",  size: 3, color: "#A855F7", delay: 0.7, dur: 7 },
  { top: "58%", left: "30%", size: 2, color: "#00E5A0", delay: 2.0, dur: 5.5 },
  { top: "68%", left: "16%", size: 3, color: "#3B82F6", delay: 0.4, dur: 6.5 },
  { top: "78%", left: "34%", size: 2, color: "#FF6B35", delay: 1.6, dur: 5 },
  { top: "26%", left: "40%", size: 2, color: "#00E5A0", delay: 2.4, dur: 7 },
];

/* Headline word-reveal variants */
const headline = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.25 } },
};
const wordUp = {
  hidden: { opacity: 0, y: 28, filter: "blur(14px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function HeroSection() {
  /* Mouse parallax */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 45, damping: 18 });
  const sy = useSpring(my, { stiffness: 45, damping: 18 });

  const photoX = useTransform(sx, [-0.5, 0.5], [18, -18]);
  const photoY = useTransform(sy, [-0.5, 0.5], [12, -12]);
  const hudX = useTransform(sx, [-0.5, 0.5], [-30, 30]);
  const hudY = useTransform(sy, [-0.5, 0.5], [-20, 20]);
  const glowX = useTransform(sx, [-0.5, 0.5], [-24, 24]);

  function handleMouse(e: React.MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }

  return (
    <section
      onMouseMove={handleMouse}
      className="relative min-h-screen overflow-hidden bg-black"
      style={{ direction: "rtl", fontFamily: "Tajawal, Arial, sans-serif" }}
    >
      {/* ── Background photo with Ken-Burns zoom + parallax ── */}
      <motion.div className="absolute inset-0" style={{ x: photoX, y: photoY, scale: 1.06 }}>
        <motion.img
          src={PHOTO}
          alt=""
          className="h-full w-full object-cover object-center"
          style={{ opacity: 0.34 }}
          initial={{ scale: 1 }}
          animate={{ scale: 1.12 }}
          transition={{ duration: 22, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />
      </motion.div>

      {/* Gradient overlay — right side dark for text */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(10,14,26,0.35) 28%, rgba(10,14,26,0.9) 56%, #0a0e1a 100%)",
        }}
      />

      {/* Aurora blobs */}
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{
          top: "-8%", right: "18%", width: 520, height: 520,
          background: "radial-gradient(circle, rgba(0,229,160,0.12), transparent 65%)",
          x: glowX,
        }}
        animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.15, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{
          bottom: "-12%", left: "10%", width: 460, height: 460,
          background: "radial-gradient(circle, rgba(59,130,246,0.1), transparent 65%)",
        }}
        animate={{ opacity: [0.4, 0.75, 0.4], scale: [1.1, 1, 1.1] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── AI scan HUD frame (parallax) — desktop only ── */}
      <motion.div className="absolute inset-0 hidden md:block" style={{ x: hudX, y: hudY }}>
        {/* Corner brackets — glowing vertex points inward toward the frame center */}
        {[
          { pos: { top: "12%", left: "5%" },  b: { borderBottom: 1, borderRight: 1 }, r: "0 0 4px 0", from: { x: -12, y: -12 } },
          { pos: { top: "12%", left: "45%" }, b: { borderBottom: 1, borderLeft: 1 },  r: "0 0 0 4px", from: { x: 12, y: -12 } },
          { pos: { bottom: "12%", left: "5%" },  b: { borderTop: 1, borderRight: 1 }, r: "0 4px 0 0", from: { x: -12, y: 12 } },
          { pos: { bottom: "12%", left: "45%" }, b: { borderTop: 1, borderLeft: 1 },  r: "4px 0 0 0", from: { x: 12, y: 12 } },
        ].map((c, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              ...c.pos,
              width: 34, height: 34,
              borderTopWidth: c.b.borderTop ? 2 : 0,
              borderRightWidth: c.b.borderRight ? 2 : 0,
              borderBottomWidth: c.b.borderBottom ? 2 : 0,
              borderLeftWidth: c.b.borderLeft ? 2 : 0,
              borderStyle: "solid",
              borderColor: "rgba(0,229,160,0.65)",
              borderRadius: c.r,
              boxShadow: "0 0 12px rgba(0,229,160,0.35)",
            }}
            initial={{ opacity: 0, ...c.from }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}

        {/* Sweeping scan line — the "body scan" */}
        <motion.div
          className="pointer-events-none absolute"
          style={{
            left: "5%", width: "40%", height: 2,
            background: "linear-gradient(90deg, transparent, rgba(0,229,160,0.7), rgba(0,229,160,0.15), transparent)",
            boxShadow: "0 0 18px rgba(0,229,160,0.5)",
          }}
          animate={{ top: ["14%", "86%", "14%"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", times: [0, 0.1, 0.9, 1] }}
        />

        {/* Static scan lines */}
        <div className="absolute" style={{ top: "34%", left: "5%", width: "36%", height: 1, background: "linear-gradient(90deg, transparent, rgba(0,229,160,0.22), transparent)" }} />
        <div className="absolute" style={{ top: "62%", left: "5%", width: "33%", height: 1, background: "linear-gradient(90deg, transparent, rgba(0,229,160,0.16), transparent)" }} />
      </motion.div>

      {/* Cinematic beam */}
      <motion.div
        className="absolute hidden md:block"
        style={{
          top: 0, right: "34%", width: 1.5, height: "60%",
          background: "linear-gradient(180deg, rgba(0,229,160,0.85), transparent)",
          boxShadow: "0 0 28px rgba(0,229,160,0.35), 0 0 55px rgba(0,229,160,0.12)",
        }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Particles */}
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute hidden rounded-full md:block"
          style={{
            top: p.top, left: p.left, width: p.size, height: p.size,
            background: p.color, boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
          animate={{ y: [-6, 6, -6], opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: p.dur, repeat: Infinity, ease: "easeInOut", delay: p.delay }}
        />
      ))}

      {/* ── Text content ── */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center px-6 sm:px-8">
        <div className="w-full max-w-2xl">
          {/* Soft glow behind headline */}
          <motion.div
            className="pointer-events-none absolute -z-10 rounded-full"
            style={{
              top: "34%", right: "6%", width: 420, height: 320,
              background: "radial-gradient(ellipse, rgba(0,229,160,0.1), transparent 70%)",
              x: glowX,
            }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Badge */}
          <motion.div
            className="mb-8 inline-flex items-center gap-2 rounded-full border px-5 py-2"
            style={{ background: "rgba(0,229,160,0.06)", borderColor: "rgba(0,229,160,0.25)" }}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <motion.span
              className="h-2 w-2 rounded-full"
              style={{ background: "#00E5A0" }}
              animate={{ boxShadow: ["0 0 0px #00E5A0", "0 0 10px #00E5A0", "0 0 0px #00E5A0"] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-sm font-semibold" style={{ color: "#00E5A0" }}>
              مدرّبك الذكي · مدعوم بالـ AI
            </span>
          </motion.div>

          {/* Headline — word-by-word blur reveal */}
          <motion.h1
            className="mb-6 text-4xl font-black leading-[1.1] text-white sm:text-6xl lg:text-7xl"
            variants={headline}
            initial="hidden"
            animate="show"
          >
            {"مدرّب يفهم جسمك".split(" ").map((w, i) => (
              <motion.span key={i} className="inline-block" style={{ marginLeft: "0.25em" }} variants={wordUp}>
                {w}
              </motion.span>
            ))}
            <br />
            <motion.span
              className="inline-block"
              variants={wordUp}
              style={{
                background: "linear-gradient(115deg, #00E5A0 15%, #3B82F6 50%, #A855F7 85%)",
                backgroundSize: "220% auto",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
              animate={{ backgroundPosition: ["0% 50%", "220% 50%"] }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear", delay: 1.2 }}
            >
              ويتطور معك
            </motion.span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            className="mb-10 text-lg leading-relaxed"
            style={{ color: "#94a3b8", maxWidth: 480 }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.7 }}
          >
            ذكاء اصطناعي يبني لك برنامج تمارين وتغذية مخصص — ويعدّله كل أسبوع بناءً على نتائجك الحقيقية.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            className="mb-12 flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05, duration: 0.6 }}
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                to="/login"
                className="inline-block rounded-2xl px-10 py-4 text-base font-black"
                style={{
                  background: "linear-gradient(135deg, #00E5A0, #00c987)",
                  color: "#0a0e1a",
                  boxShadow: "0 0 34px rgba(0,229,160,0.4), 0 0 70px rgba(0,229,160,0.15)",
                }}
              >
                ابدأ مجاناً ←
              </Link>
            </motion.div>
            <motion.button
              onClick={() =>
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
              }
              whileHover={{ scale: 1.04, borderColor: "rgba(0,229,160,0.4)" }}
              whileTap={{ scale: 0.97 }}
              className="rounded-2xl border px-8 py-4 text-base font-medium"
              style={{ borderColor: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.75)" }}
            >
              شوف كيف يشتغل
            </motion.button>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="flex flex-wrap gap-9"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.25, duration: 0.7 }}
          >
            {STATS.map(({ num, label }, i) => (
              <div key={label}>
                <div className="text-3xl font-black" style={{ color: STAT_COLORS[i % 4] }}>
                  {num}
                </div>
                <div className="mt-1 text-sm" style={{ color: "#64748b" }}>{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-center">
        <motion.div
          className="mx-auto flex items-start justify-center rounded-full border pt-1.5"
          style={{ width: 22, height: 34, borderColor: "rgba(255,255,255,0.16)" }}
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="rounded-sm" style={{ width: 3, height: 7, background: "#00E5A0", opacity: 0.7 }} />
        </motion.div>
      </div>
    </section>
  );
}
