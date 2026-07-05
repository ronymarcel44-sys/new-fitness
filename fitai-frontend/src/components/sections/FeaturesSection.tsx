import { motion } from "framer-motion";

/* ── Step cards data ─────────────────────────────────────── */
const STEPS = [
  {
    num: "١",
    color: "#00E5A0",
    rgbColor: "0,229,160",
    borderColor: "rgba(0,229,160,0.15)",
    photo:
      "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400&q=75&auto=format&fit=crop&crop=center",
    label: "الخطوة الأولى",
    title: "حدّثنا عن نفسك",
    desc: "المدرّب الذكي يسألك عن جسمك وهدفك ومستوى نشاطك",
    icon: (
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="10" width="36" height="24" rx="6" fill="rgba(0,229,160,0.12)" stroke="rgba(0,229,160,0.4)" strokeWidth="1.5" />
        <path d="M14 30 L10 38 L20 32" fill="rgba(0,229,160,0.12)" stroke="rgba(0,229,160,0.4)" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="13" y1="18" x2="35" y2="18" stroke="rgba(0,229,160,0.5)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="13" y1="24" x2="28" y2="24" stroke="rgba(0,229,160,0.3)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    num: "٢",
    color: "#3B82F6",
    rgbColor: "59,130,246",
    borderColor: "rgba(59,130,246,0.15)",
    photo:
      "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400&q=75&auto=format&fit=crop&crop=center",
    label: "الخطوة الثانية",
    title: "خطتك في ثوانٍ",
    desc: "تمارين + تغذية مخصصة لجسمك تماماً",
    icon: (
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="12" fill="rgba(59,130,246,0.1)" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="5" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.6)" strokeWidth="1" />
        <line x1="24" y1="12" x2="24" y2="6" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="36" y1="24" x2="42" y2="24" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="24" x2="6" y2="24" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="24" y1="36" x2="24" y2="42" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24" cy="6" r="2" fill="#3B82F6" />
        <circle cx="42" cy="24" r="2" fill="#3B82F6" />
        <circle cx="6" cy="24" r="2" fill="#3B82F6" />
        <circle cx="24" cy="42" r="2" fill="#3B82F6" />
      </svg>
    ),
  },
  {
    num: "٣",
    color: "#A855F7",
    rgbColor: "168,85,247",
    borderColor: "rgba(168,85,247,0.15)",
    photo:
      "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=75&auto=format&fit=crop&crop=center",
    label: "الخطوة الثالثة",
    title: "يتطور معك",
    desc: "يحلل تقدمك ويعدّل الخطة كل أسبوع",
    icon: (
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
        <polyline points="6,38 16,28 26,32 38,14" stroke="rgba(168,85,247,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <polyline points="6,38 16,28 26,32 38,14" stroke="rgba(168,85,247,0.15)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="6" cy="38" r="3" fill="#A855F7" opacity="0.7" />
        <circle cx="16" cy="28" r="3" fill="#A855F7" opacity="0.7" />
        <circle cx="26" cy="32" r="3" fill="#A855F7" opacity="0.7" />
        <circle cx="38" cy="14" r="3.5" fill="#A855F7" />
        <line x1="6" y1="42" x2="42" y2="42" stroke="rgba(168,85,247,0.2)" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
  },
];

/* ── Feature cards data ──────────────────────────────────── */
const FEATURES = [
  {
    color: "#00E5A0",
    rgbColor: "0,229,160",
    borderColor: "rgba(0,229,160,0.1)",
    photo:
      "https://images.unsplash.com/photo-1581009137042-c552e485697a?w=400&q=70&auto=format&fit=crop&crop=center",
    title: "تمارين مخصصة",
    desc: "خطة أسبوعية كاملة بأوزان وتكرارات محسوبة لجسمك — يتغير كل أسبوع",
    badge: undefined,
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
        <rect x="1" y="13" width="6" height="6" rx="2" fill="rgba(0,229,160,0.2)" stroke="rgba(0,229,160,0.6)" strokeWidth="1.2" />
        <rect x="25" y="13" width="6" height="6" rx="2" fill="rgba(0,229,160,0.2)" stroke="rgba(0,229,160,0.6)" strokeWidth="1.2" />
        <rect x="4" y="11" width="4" height="10" rx="1.5" fill="rgba(0,229,160,0.3)" stroke="rgba(0,229,160,0.5)" strokeWidth="1" />
        <rect x="24" y="11" width="4" height="10" rx="1.5" fill="rgba(0,229,160,0.3)" stroke="rgba(0,229,160,0.5)" strokeWidth="1" />
        <line x1="8" y1="16" x2="24" y2="16" stroke="rgba(0,229,160,0.5)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    color: "#FF6B35",
    rgbColor: "255,107,53",
    borderColor: "rgba(255,107,53,0.1)",
    photo:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&q=70&auto=format&fit=crop&crop=center",
    title: "تغذية ذكية",
    desc: "سعرات وبروتين وكربوهيدرات محسوبة على هدفك — مع تسجيل الوجبات",
    badge: undefined,
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
        <path d="M4 14 Q4 26 16 26 Q28 26 28 14 Z" fill="rgba(255,107,53,0.15)" stroke="rgba(255,107,53,0.5)" strokeWidth="1.2" />
        <line x1="4" y1="14" x2="28" y2="14" stroke="rgba(255,107,53,0.4)" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="11" cy="19" r="2.5" fill="rgba(0,229,160,0.3)" stroke="rgba(0,229,160,0.5)" strokeWidth="1" />
        <circle cx="18" cy="17" r="2" fill="rgba(255,107,53,0.4)" stroke="rgba(255,107,53,0.6)" strokeWidth="1" />
        <path d="M15 8 Q18 4 22 6 Q20 10 16 10 Z" fill="rgba(0,229,160,0.3)" stroke="rgba(0,229,160,0.5)" strokeWidth="1" />
      </svg>
    ),
  },
  {
    color: "#3B82F6",
    rgbColor: "59,130,246",
    borderColor: "rgba(59,130,246,0.1)",
    photo:
      "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&q=70&auto=format&fit=crop&crop=center",
    title: "تتبع التقدم",
    desc: "رسوم بيانية لوزنك وقياساتك وأداء التمارين أسبوعاً بأسبوع",
    badge: undefined,
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
        <rect x="3" y="20" width="5" height="8" rx="1.5" fill="rgba(59,130,246,0.3)" stroke="rgba(59,130,246,0.5)" strokeWidth="1" />
        <rect x="11" y="14" width="5" height="14" rx="1.5" fill="rgba(59,130,246,0.4)" stroke="rgba(59,130,246,0.6)" strokeWidth="1" />
        <rect x="19" y="8" width="5" height="20" rx="1.5" fill="rgba(59,130,246,0.55)" stroke="rgba(59,130,246,0.7)" strokeWidth="1" />
        <line x1="2" y1="28" x2="30" y2="28" stroke="rgba(59,130,246,0.25)" strokeWidth="1" strokeLinecap="round" />
        <polyline points="5,22 13,16 21,10" stroke="rgba(0,229,160,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    color: "#A855F7",
    rgbColor: "168,85,247",
    borderColor: "rgba(168,85,247,0.1)",
    photo:
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=70&auto=format&fit=crop&crop=center",
    title: "مدرّب بشري",
    desc: "مدرّب حقيقي يراجع خطتك ويضيف ملاحظاته الشخصية",
    badge: "PREMIUM",
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
        <circle cx="13" cy="10" r="5" fill="rgba(168,85,247,0.15)" stroke="rgba(168,85,247,0.5)" strokeWidth="1.2" />
        <path d="M4 26 Q4 20 13 20 Q18 20 20 23" stroke="rgba(168,85,247,0.5)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <path d="M25 14 L26.5 18 L30.5 18 L27.5 20.5 L28.5 24.5 L25 22 L21.5 24.5 L22.5 20.5 L19.5 18 L23.5 18 Z" fill="rgba(168,85,247,0.25)" stroke="rgba(168,85,247,0.6)" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function FeaturesSection() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden px-6 py-20"
      style={{ background: "#080b14", direction: "rtl", fontFamily: "Tajawal, Arial, sans-serif" }}
    >
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      {/* Glow blobs */}
      <div className="pointer-events-none absolute -top-20 right-[10%] h-80 w-80 rounded-full" style={{ background: "radial-gradient(circle, rgba(0,229,160,0.07), transparent 65%)" }} />
      <div className="pointer-events-none absolute -bottom-16 left-[15%] h-72 w-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.07), transparent 65%)" }} />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-[500px] -translate-x-1/2 -translate-y-1/2" style={{ background: "radial-gradient(ellipse, rgba(168,85,247,0.04), transparent 70%)" }} />

      <div className="relative mx-auto max-w-6xl">
        {/* Section header */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="mb-4 text-sm font-bold tracking-[5px]" style={{ color: "#00E5A0", opacity: 0.85 }}>
            كيف يعمل FitAI
          </p>
          <h2 className="mb-4 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
            ليس مجرد تطبيق رياضة —{" "}
            <span style={{ background: "linear-gradient(135deg,#00E5A0,#3B82F6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              مدرّب ذكي يتابعك
            </span>
          </h2>
          <p className="text-base leading-relaxed" style={{ color: "#64748b" }}>
            من أول محادثة حتى هدفك النهائي
          </p>
        </motion.div>

        {/* 3-step cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              className="relative overflow-hidden rounded-xl"
              style={{ border: `1px solid ${step.borderColor}`, minHeight: 240 }}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
            >
              <img src={step.photo} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.22 }} />
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(180deg, rgba(${step.rgbColor},0.08) 0%, rgba(8,11,20,0.92) 100%)` }}
              />
              {/* Step number badge */}
              <div
                className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md border text-xs font-black"
                style={{ background: `rgba(${step.rgbColor},0.15)`, borderColor: `${step.color}55`, color: step.color }}
              >
                {step.num}
              </div>
              {/* SVG icon */}
              <div className="absolute left-1/2 top-3 -translate-x-1/2">{step.icon}</div>
              {/* Text */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="mb-1.5 text-[11px] font-bold tracking-wide" style={{ color: step.color, opacity: 0.85 }}>
                  {step.label}
                </p>
                <p className="mb-1.5 text-lg font-black text-white">{step.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Divider */}
        <div className="mb-8 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />

        {/* 4 feature cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              className="relative overflow-hidden rounded-xl p-5"
              style={{ border: `1px solid ${f.borderColor}` }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <img src={f.photo} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.16 }} />
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, rgba(${f.rgbColor},0.06), rgba(8,11,20,0.85))` }}
              />
              {f.badge && (
                <div
                  className="absolute left-2.5 top-2.5 rounded px-1.5 py-0.5 text-[8px] font-bold"
                  style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.35)", color: "#A855F7" }}
                >
                  {f.badge}
                </div>
              )}
              <div className="relative">
                <div className="mb-3">{f.icon}</div>
                <p className="mb-2 text-lg font-black text-white">{f.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
