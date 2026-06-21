import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { tajawal: ["Tajawal", "sans-serif"] },
      colors: {
        bg: { DEFAULT: "#0A0E1A", card: "#111827", hover: "#1a2236" },
        accent: { DEFAULT: "#00E5A0", dim: "#00c987" },
        brand: { orange: "#FF6B35", blue: "#3B82F6", purple: "#A855F7", pink: "#EC4899" },
      },
      backgroundImage: {
        "gradient-accent": "linear-gradient(135deg, #00E5A0, #00c987)",
        "gradient-hero": "linear-gradient(135deg, #00E5A0, #3B82F6)",
      },
      boxShadow: {
        accent: "0 0 40px rgba(0,229,160,0.25)",
        "accent-lg": "0 0 60px rgba(0,229,160,0.35)",
      },
    },
  },
  plugins: [],
} satisfies Config;
