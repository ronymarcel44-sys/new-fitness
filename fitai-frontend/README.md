# FitAI — منصة التدريب الشخصي الذكية

## 🚀 تشغيل المشروع

```bash
npm install
npm run dev
```
افتح: **http://localhost:5173**

---

## 🔑 إضافة Gemini API Key

افتح الملف: `src/lib/constants.ts`
غيّر هذا السطر:
```ts
export const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
```
احصل على مفتاحك المجاني من: https://aistudio.google.com/apikey

---

## 🔐 حسابات الدخول التجريبية

| المستخدم | الباسورد |
|----------|----------|
| admin    | 1234     |
| user1    | 1234     |
| demo     | demo     |

---

## 🔄 طريقة عمل التطبيق

1. **تسجيل الدخول** ← بحساب وهمي
2. **المساعد الذكي** ← يسأل عن عمرك، وزنك، هدفك، أمراضك
3. **إنشاء الخطة** ← الـ AI يبني خطة تمارين وتغذية مخصصة
4. **الصفحات تتملى** ← Dashboard, Workout, Nutrition تعرض خطتك
5. **تسجيل الخروج** ← تمسح كل البيانات

---

## 📁 هيكل الملفات

```
src/
├── app/
│   ├── store.ts          ← Redux Store
│   └── hooks.ts          ← Typed hooks
├── features/
│   ├── auth/             ← تسجيل الدخول/الخروج
│   ├── user/             ← بيانات المستخدم
│   ├── workout/          ← خطة التمارين
│   ├── nutrition/        ← الخطة الغذائية
│   ├── chat/             ← المحادثة مع AI
│   └── progress/         ← التقدم
├── components/
│   ├── layout/Navbar
│   ├── ui/ (Card, Badge, ProgressBar, EmptyState)
│   └── sections/ (Hero, Features)
├── pages/
│   ├── LandingPage
│   ├── LoginPage
│   ├── DashboardPage
│   ├── WorkoutPage
│   ├── NutritionPage
│   ├── ChatPage
│   └── ProgressPage
└── lib/
    ├── constants.ts      ← إعدادات + مستخدمون وهميون
    ├── gemini.ts         ← Gemini API helper
    └── utils.ts
```
