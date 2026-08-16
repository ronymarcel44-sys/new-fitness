// src/lib/constants.ts

import type { UserRole } from "@/types";

// ── Coach certificates ────────────────────────────────────────────
// Known certifying bodies for the coach registration/profile dropdown.
// "أخرى" is the free-text fallback — picking it reveals a text box for a
// custom certificate name.
export const CERT_TYPES = ["ISSA", "NASM", "ACE", "NSCA", "ACSM", "أخرى"] as const;

// ── حسابات تجريبية لتسجيل الدخول ─────────────────────────────────────────────
// [تغيير] أُضيف حساب coach1 لاختبار بوابة المدرب
export const FAKE_USERS: {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
}[] = [
  { username: "admin",  password: "admin123", displayName: "مدير النظام",   role: "admin" },
  { username: "coach1", password: "coach123", displayName: "خالد المدرب",   role: "coach" }, // جديد
  { username: "user1",  password: "1234",     displayName: "سارة علي",       role: "user"  },
  { username: "demo",   password: "demo",     displayName: "مستخدم تجريبي", role: "user"  },
];

// [جديد] المستخدمون المُعيَّنون للمدرب coach1 — يُستخدم في CoachDashboard
// في Phase 3 سيأتي هذا من قاعدة البيانات بدلاً من هذه القائمة الثابتة
export const COACH_ASSIGNED_USER_IDS = ["user1", "demo"];

// ── Setup ─────────────────────────────────────────────────────────
export const SETUP_QUESTIONS = [
  "ما عمرك؟",
  "ما وزنك الحالي بالكيلوغرام؟",
  "ما طولك بالسنتيمتر؟",
  "ما هدفك الرئيسي؟ (خسارة وزن / بناء عضلات / لياقة عامة)",
  "ما مستوى خبرتك الرياضية؟ (مبتدئ / متوسط / متقدم)",
  "هل تعاني من أي أمراض أو إصابات يجب مراعاتها؟",
];

// ── User Nav ──────────────────────────────────────────────────────
export const NAV_LINKS = [
  { path: "/dashboard",  label: "الرئيسية" },
  { path: "/workout",    label: "التمارين"  },
  { path: "/nutrition",  label: "التغذية"   },
  { path: "/chat",       label: "المساعد"   },
  { path: "/progress",   label: "التقدم"    },
  { path: "/weekly-plan",label: "الجدول"    },
  { path: "/profile",    label: "حسابي"     },
];

// ── Admin Nav ─────────────────────────────────────────────────────
export const ADMIN_NAV_LINKS = [
  { path: "/admin",               label: "لوحة التحكم" },
  { path: "/admin/profit",        label: "الأرباح" },
  { path: "/admin/users",         label: "المستخدمون"   },
  { path: "/admin/coaches",       label: "المدربون"     },
  { path: "/admin/subscriptions", label: "الاشتراكات"   },
];

// ── Landing ───────────────────────────────────────────────────────
export const FEATURES = [
  { icon: "🧠", title: "مدرب ذكي شخصي",       desc: "يحلل بياناتك ويبني برنامجاً فريداً يتكيّف مع تقدمك",      color: "#00E5A0" },
  { icon: "🍎", title: "خطة غذائية دقيقة",     desc: "وجبات محسوبة بالسعرات تناسب هدفك تماماً",                color: "#FF6B35" },
  { icon: "📊", title: "تتبع التقدم",           desc: "رسوم بيانية تُظهر تطور جسمك أسبوعاً بأسبوع",            color: "#3B82F6" },
  { icon: "🤖", title: "مساعد AI 24/7",         desc: "اسأل أي سؤال رياضي واحصل على إجابة علمية فورية",        color: "#A855F7" },
  { icon: "🎥", title: "مكتبة تمارين بالعربية", desc: "أكثر من 200 تمرين بمستويات متدرجة",                     color: "#EC4899" },
  { icon: "💳", title: "باقات مرنة",            desc: "مجانية للبداية وبريميوم للنتائج الأسرع",                color: "#F59E0B" },
];

export const STATS = [
  { num: "+٥٠٠٠", label: "مستخدم نشط"     },
  { num: "٢٤/٧",  label: "متابعة مستمرة"  },
  { num: "+٢٠٠",  label: "تمرين بالعربية" },
  { num: "٩٨٪",   label: "نسبة الرضا"     },
];