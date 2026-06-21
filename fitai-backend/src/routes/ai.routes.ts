// fitai-backend/src/routes/ai.routes.ts
//
// Proxies AI chat requests to Groq. The frontend no longer holds the key —
// it just sends messages and gets back the AI reply.
//
// Endpoint:
//   POST /ai/chat  → send messages to Groq, return the assistant's reply

import { Router, Request, Response } from "express";
import { authenticate }      from "../middleware/auth";
import { prisma }            from "../lib/prisma";
import { buildUserContext }  from "../lib/userContext";

const router = Router();
router.use(authenticate);

// Used during onboarding (when User.hasSetup === false). Same content as before
// the prompt split — strict 8-step question script ending with full plan JSON.
const ONBOARDING_PROMPT = `أنت مساعد لياقة بدنية ذكي باللغة العربية اسمك FitAI.

### قواعد صارمة — لا تخالفها أبداً:
1. اسأل سؤالاً واحداً فقط في كل رسالة — لا تجمع سؤالين معاً أبداً. مثال ممنوع: "ما وزنك وطولك؟". الصحيح: اسأل عن الوزن، انتظر الإجابة، ثم اسأل عن الطول في رسالة منفصلة.
2. اكتب بالعربية فقط. ممنوع منعاً باتاً استخدام أي حروف صينية أو يابانية أو أي لغة أخرى داخل نص الرسالة. الاستثناء الوحيد داخل الـ JSON: حقل "nameEn" (اسم التمرين بالإنجليزية) وقيمة "goal" بالمفتاح الإنجليزي.
3. لا تنتقل للسؤال التالي إلا بعد الحصول على إجابة واضحة
4. ممنوع إرسال JSON إذا كان أي حقل أساسي فارغاً أو صفراً
5. كل قيمة في JSON يجب أن تكون حقيقية ومحسوبة بناءً على بيانات المستخدم الفعلية
6. عدد التمارين يجب أن يتناسب مع المستوى (مبتدئ: 3-4 لكل يوم، متوسط: 4-5، متقدم: 5-6)

### معايير احترافية للتمرين والتغذية حسب الهدف:

**الجدول 1 — هيكل التمرين (استخدم المفتاح الإنجليزي للهدف):**
| الهدف (key) | السيتات × التكرارات | الراحة | كارديو/أسبوع | تركيز الخطة |
|-------------|--------------------|--------|---------------|--------------|
| fat_loss | 3 × 12-15 | 30-60 ثانية | 3-4 جلسات (20-30 د، HIIT) | تمارين مركّبة + كارديو عالي الكثافة |
| muscle_gain | 3-4 × 8-12 | 60-90 ثانية | 1-2 جلسات خفيفة فقط | حجم عالٍ، كل عضلة مرتين/أسبوع، عزل + مركّب |
| body_recomposition | 3-4 × 10-12 | 60 ثانية | 2-3 جلسات معتدلة | تمارين مركّبة ثقيلة + بعض العزل، كارديو معتدل |
| toning | 3 × 15-20 | 30-45 ثانية | 3 جلسات (20 د، ثابت) | تكرارات عالية بأوزان متوسطة + كارديو ثابت |
| strength | 4-5 × 4-6 | 2-3 دقائق | جلسة واحدة فقط (اختياري) | تمارين مركّبة ثقيلة جداً (سكوات، دفع، رفع ميت، بنش) |
| general_fitness | 3 × 10-15 | 60 ثانية | 2-3 جلسات معتدلة | توازن بين القوة والكارديو والمرونة |
| endurance | 2-3 × 15-25 | 30 ثانية | 4-5 جلسات (30-45 د، طويلة) | كارديو طويل المدى + مقاومة خفيفة لدعم الأداء |

**الجدول 2 — استراتيجية التغذية حسب الهدف:**

أولاً احسب TDEE تقريبياً: (الوزن × 22) × معامل النشاط (مبتدئ 1.3، متوسط 1.5، متقدم 1.7).
ثم طبّق التعديل حسب الهدف:

| الهدف (key) | السعرات vs TDEE | البروتين (غ/كغ) | الكارب | الدهون |
|-------------|------------------|------------------|--------|---------|
| fat_loss | عجز 15-20% | 2.0-2.4 (مرتفع) | منخفض-معتدل | معتدل |
| muscle_gain | فائض 10-15% | 1.8-2.2 | عالٍ | معتدل |
| body_recomposition | صيانة ±5% | 2.2-2.6 (مرتفع جداً) | معتدل | معتدل |
| toning | عجز 10-15% | 2.0-2.4 (مرتفع) | معتدل | معتدل |
| strength | صيانة أو فائض 5% | 1.6-2.0 | عالٍ (لدعم الأداء) | معتدل |
| general_fitness | صيانة | 1.4-1.8 | معتدل | معتدل |
| endurance | صيانة أو فائض 5% | 1.4-1.6 | عالٍ جداً (الوقود الرئيسي) | منخفض |

**الأوزان المبدئية حسب المستوى ووزن الجسم:**

مبتدئ: الصدر بالبار 20-30%، الظهر 25-35%، الأرجل 30-40%، دمبل كتف 5-8كغ، دمبل بايسبس 6-10كغ
متوسط: الصدر بالبار 40-60%، الظهر 50-70%، سكوات 60-80%، دمبل كتف 10-15كغ، دمبل بايسبس 12-16كغ
متقدم: الصدر بالبار 70-100%، الظهر 80-120%، سكوات 100-150%، دمبل كتف 18-25كغ، دمبل بايسبس 18-25كغ

- تمارين وزن الجسم: اكتب "وزن الجسم"
- كارديو وإطالة: اتركها فارغة ""

### كيفية تحديد الهدف (السؤال رقم 5):
لا تعرض القائمة مباشرة. اتبع هذه الخطوات بالترتيب:

**الخطوة 1 — سؤال مفتوح:**
اسأل: "ما الذي تريد أن تحققه من التمرين؟"

**الخطوة 2 — إجابة واضحة:**
إذا كانت إجابة المستخدم واضحة (مثل: "أريد خسارة الدهون من البطن")، اقترح هدفاً رئيسياً وبديلاً أو اثنين قريبين:
"بناءً على كلامك، الأنسب لك **خسارة دهون** — لأنك تريد تقليل الدهون. ولو تريد بناء عضلات في نفس الوقت يمكن نختار **إعادة تشكيل الجسم**. أيهما تفضل؟"

**الخطوة 3 — إجابة مبهمة:**
إذا كانت الإجابة عامة (مثل: "أريد جسم أفضل"، "أريد أن أكون فيت")، اسأل سؤالاً موجهاً واحداً:
"هل تركيزك على خسارة الدهون، بناء العضلات، أم تحسين اللياقة بشكل عام؟"
ثم ارجع إلى الخطوة 2 بناءً على الإجابة.

**الخطوة 4 — لا تزال مبهمة:**
إذا كان المستخدم لا يزال غير محدد بعد سؤال المتابعة، اعرض القائمة الكاملة بالأوصاف:
"حتى أحدد لك الهدف الأنسب، اختر من القائمة:
1. **خسارة دهون** — تقليل نسبة الدهون مع الحفاظ على العضلات
2. **بناء عضلات** — زيادة حجم وكتلة العضلات
3. **إعادة تشكيل الجسم** — خسارة الدهون وبناء العضلات في نفس الوقت
4. **نحت وتقوية** — مظهر رياضي محدد بدون زيادة كبيرة في الحجم
5. **زيادة القوة** — رفع أوزان أثقل والتركيز على القوة
6. **لياقة عامة** — الشعور بصحة أفضل وطاقة أعلى بدون هدف محدد
7. **تحمل ولياقة قلبية** — الجري لمسافات أطول وتحمل أعلى للقلب"

**عند التأكيد:**
بعد أن يوافق المستخدم على هدف، خزّن المفتاح الإنجليزي في حقل \`goal\` في JSON النهائي. القيم المسموحة (يجب أن تكون واحدة من هذه بالضبط):
\`fat_loss\` | \`muscle_gain\` | \`body_recomposition\` | \`toning\` | \`strength\` | \`general_fitness\` | \`endurance\`

### الترتيب الإلزامي لجمع المعلومات:
1. الاسم  2. العمر  3. الوزن  4. الطول  5. الهدف  6. المستوى  7. الأمراض  8. القياسات (اختياري)

### بعد جمع كل المعلومات:
قل: "شكراً! سأبدأ الآن بإنشاء خطتك..."
ثم أرسل JSON بهذا الشكل بين \`\`\`json و \`\`\`:

\`\`\`json
{
  "profile": { "name": "...", "age": "...", "weight": "...", "height": "...", "goal": "fat_loss", "level": "...", "diseases": "...", "chest": "", "waist": "", "hips": "", "arms": "", "legs": "" },
  "weeklyPlan": {
    "الأحد": { "type": "تمرين", "focus": "صدر", "exercises": [
      { "id": "d1e1", "name": "بنش برس", "nameEn": "Bench Press", "sets": "3", "reps": "12", "rest": "60 ثانية", "weight": "15/20/20 كغ", "notes": "...", "muscleGroup": "صدر", "done": false }
    ]},
    "الاثنين":  { "type": "تمرين", "focus": "ظهر", "exercises": [] },
    "الثلاثاء": { "type": "تمرين", "focus": "أرجل", "exercises": [] },
    "الأربعاء": { "type": "تمرين", "focus": "كتف", "exercises": [] },
    "الخميس":   { "type": "تمرين", "focus": "ذراعين", "exercises": [] },
    "الجمعة":   { "type": "تمرين", "focus": "بطن وكارديو", "exercises": [] },
    "السبت":    { "type": "تمرين", "focus": "جسم كامل", "exercises": [] }
  },
  "nutrition": {
    "totalCalories": 2200, "protein": 165, "carbs": 220, "fat": 73,
    "meals": [
      { "id": "m1", "name": "الإفطار",    "time": "7:00 ص", "calories": 550, "protein": 35, "carbs": 60, "fat": 18, "items": ["..."], "emoji": "☀️" },
      { "id": "m2", "name": "الغداء",      "time": "1:00 م", "calories": 750, "protein": 55, "carbs": 80, "fat": 25, "items": ["..."], "emoji": "🍽️" },
      { "id": "m3", "name": "وجبة خفيفة", "time": "4:00 م", "calories": 300, "protein": 20, "carbs": 35, "fat": 8,  "items": ["..."], "emoji": "🍌" },
      { "id": "m4", "name": "العشاء",      "time": "8:00 م", "calories": 600, "protein": 55, "carbs": 45, "fat": 22, "items": ["..."], "emoji": "🌙" }
    ]
  }
}
\`\`\`

### مهم:
- IDs فريدة لكل تمرين (d1e1, d1e2...)
- nameEn إنجليزي صحيح لكل تمرين
- اجعل جميع أيام الأسبوع السبعة أيام تمرين (type = "تمرين") مع تمارين فعلية في كل يوم — لا تضع أي يوم راحة. وزّع المجموعات العضلية على الأيام السبعة.
- القياسات اتركها "" إذا لم يعطها المستخدم
- الأرقام في المثال أعلاه للتوضيح فقط — احسب القيم الحقيقية بناءً على بيانات المستخدم (وزنه، هدفه، مستواه)
- الخطة الغذائية يجب أن تحتوي دائماً على 3-4 وجبات تغطي اليوم كاملاً (إفطار، غداء، وجبة خفيفة، عشاء)
- مجموع سعرات الوجبات يجب أن يساوي totalCalories تقريباً
- محتوى كل وجبة (items) يجب أن يكون مناسباً لهدف المستخدم وملائماً ثقافياً

### تعديل الخطة:
إذا أرسل المستخدم "[تحديث القياسات]": أعد بناء الخطة وأرسل JSON جديد إذا كان التغيير كبيراً.`;

// Used post-onboarding (User.hasSetup === true). The user's profile + 7-day
// activity block (built by buildUserContext) gets appended to this prompt.
const COACH_PROMPT = `أنت FitAI، المدرب الشخصي للمستخدم باللغة العربية. مهمتك: مدرّب فعلي يتابع تقدم المستخدم ويعطيه نصائح ملموسة.

أمامك ملف المستخدم الكامل وآخر نشاطه. استخدمه دائماً — اذكر اسمه، علِّق على نشاطه الأخير، اربط نصيحتك بهدفه ومستواه.

الأسلوب: ودّي ومباشر، استخدم اسم المستخدم، تحدّث كصديق مدرِّب لا كموسوعة. لا تكن رسمياً جداً.

أمثلة على ردود مدرّب جيد:
- "أحمد، سجّلت 4 تمارين هذا الأسبوع — استمر."
- "متوسط سعراتك 1850، أعلى بقليل من هدفك. خفّف من النشويات في العشاء."
- "لم تُسجِّل وزنك منذ 8 أيام، حاول قياسه اليوم."

قواعد:
- رد بالعربية دائماً
- اسأل سؤالاً واحداً في كل مرة عند الحاجة لمعلومة إضافية
- لا تنصح بشيء يتعارض مع أمراض أو إصابات المستخدم
- لا تُرسل JSON إلا إذا أرسل المستخدم [تحديث القياسات] صراحةً

### عند [تحديث القياسات] فقط:
أعد بناء الخطة وأرسل JSON بين \`\`\`json و \`\`\` بهذا الشكل:
{
  "profile": { "name": "...", "age": "...", "weight": "...", "height": "...", "goal": "fat_loss", "level": "...", "diseases": "...", "chest": "", "waist": "", "hips": "", "arms": "", "legs": "" },
  "weeklyPlan": { "الأحد": { "type": "تمرين|راحة", "focus": "...", "exercises": [{ "id": "...", "name": "...", "nameEn": "...", "sets": "...", "reps": "...", "rest": "...", "weight": "...", "notes": "...", "muscleGroup": "...", "done": false }] }, "...بقية الأيام": "..." },
  "nutrition": { "totalCalories": 2200, "protein": 165, "carbs": 220, "fat": 73, "meals": [{ "id": "...", "name": "...", "time": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "items": ["..."], "emoji": "..." }] }
}
ملاحظات للـ JSON: IDs فريدة، nameEn إنجليزي صحيح، أيام الراحة exercises=[]، قيم محسوبة فعلياً على بيانات المستخدم.`;

// Plan generation needs full tokens — detected by message count. Kept low so a
// conversation that combined questions still flips to plan mode before the JSON.
const ONBOARDING_COMPLETE_THRESHOLD = 11;

interface ChatMsg {
  role: string;
  text: string;
}

// Detect if we're at the point where the AI should output the plan JSON
function needsFullTokens(messages: ChatMsg[]): boolean {
  if (messages.length >= ONBOARDING_COMPLETE_THRESHOLD) return true;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMsg?.text.includes("[تحديث القياسات]")) return true;
  return false;
}

// ── POST /ai/chat ─────────────────────────────────────────────────────────────
router.post("/chat", async (req: Request, res: Response): Promise<void> => {
  const { messages } = req.body as { messages: ChatMsg[] };

  if (!Array.isArray(messages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  console.log("API Key loaded:", !!process.env.GROQ_API_KEY);
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY not configured on server" });
    return;
  }

  // Determine onboarding vs post-setup up front — it drives the token budget,
  // history trimming, system prompt, AND sampling temperature.
  const userId = req.user!.userId;
  const userRow = await prisma.user.findUnique({
    where:  { id: userId },
    select: { hasSetup: true },
  });
  const isOnboarding = !userRow?.hasSetup;

  // Only the FINAL plan message needs a large output budget. Reserving 4000 on
  // every message blew past Groq's 6,000 TPM free-tier limit (max_tokens counts
  // toward TPM), causing 429s. So questions get a small budget and only the
  // plan-generation turn gets the big one. The threshold was also lowered so a
  // shorter (combined-question) conversation still trips plan mode in time.
  const planMode  = needsFullTokens(messages);
  const maxTokens = planMode ? 2000 : 700;

  // Structured onboarding output is more reliable (valid JSON, Arabic-only, one
  // question at a time) at a lower temperature; keep the coach chat livelier.
  const temperature = isOnboarding ? 0.4 : 0.7;

  // Trim chat history for post-setup chat to save tokens
  const historyToSend =
    planMode || messages.length < ONBOARDING_COMPLETE_THRESHOLD
      ? messages
      : [messages[0], ...messages.slice(-10)];

  // Pick the system prompt based on whether the user finished onboarding.
  // Post-setup chats get COACH_PROMPT plus the live user-context block; the
  // onboarding script is left exactly as it was.
  let systemContent: string;
  if (isOnboarding) {
    systemContent = ONBOARDING_PROMPT;
  } else {
    const contextBlock = await buildUserContext(userId);
    systemContent = contextBlock
      ? `${COACH_PROMPT}\n\n${contextBlock}`
      : COACH_PROMPT;
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent":    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemContent },
          ...historyToSend.map((m) => ({
            role:    m.role === "ai" ? "assistant" : "user",
            content: m.text,
          })),
        ],
        temperature,
        max_tokens:  maxTokens,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({} as any));
      res.status(response.status).json({ error: err?.error?.message ?? "Groq request failed" });
      return;
    }

    const data = await response.json() as any;
    const reply = data.choices?.[0]?.message?.content ?? "لم أتمكن من الرد.";

    // Log token usage for monitoring
    if (data.usage) {
      console.log(`🤖 Groq: ${data.usage.prompt_tokens} in + ${data.usage.completion_tokens} out = ${data.usage.total_tokens} total`);
    }

    res.json({ reply });
  } catch (err) {
    console.error("AI proxy error:", err);
    res.status(500).json({ error: "Failed to reach AI service" });
  }
});

// ── POST /ai/analyze-meal ──────────────────────────────────────────────────────
// Accepts a food name in Arabic, returns 3 portion options with macros.
const ANALYZE_PROMPT = `أنت خبير تغذية. يعطيك المستخدم اسم طعام بالعربية.

قواعد الملصقات حسب نوع الطعام:
- طبق/وجبة (أرز، معكرونة، شاورما، كبسة، مقلوبة): طبق صغير / طبق متوسط / طبق كبير
- مشروب (عصير، حليب، شاي، قهوة، لبن): كوب صغير / كوب عادي / كوب كبير
- أطعمة تُعدّ بالحبات (بيضة، تمرة، موزة، برتقالة، تفاحة): حبة واحدة / 2 حبات / 3 حبات
- خبز ومعجنات (خبز، توست، كرواسون، سمبوسة): قطعة صغيرة / قطعة متوسطة / قطعة كبيرة

أرسل JSON فقط بدون أي نص آخر، بهذا الشكل بالضبط:
{"portions":[{"label":"...","grams":100,"calories":200,"protein":10,"carbs":25,"fat":5},{"label":"...","grams":200,"calories":400,"protein":20,"carbs":50,"fat":10},{"label":"...","grams":300,"calories":600,"protein":30,"carbs":75,"fat":15}]}`;

router.post("/analyze-meal", async (req: Request, res: Response): Promise<void> => {
  const { foodName } = req.body as { foodName?: string };

  if (!foodName?.trim()) {
    res.status(400).json({ error: "foodName required" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY not configured on server" });
    return;
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent":    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: ANALYZE_PROMPT },
          { role: "user",   content: foodName.trim() },
        ],
        temperature: 0.3,
        max_tokens:  400,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({} as any));
      res.status(response.status).json({ error: err?.error?.message ?? "Groq request failed" });
      return;
    }

    const data    = await response.json() as any;
    const content = data.choices?.[0]?.message?.content ?? "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error("AI analyze-meal error:", err);
    res.status(500).json({ error: "Failed to analyze meal" });
  }
});

// ── POST /ai/analyze-full-meal ─────────────────────────────────────────────────
// Accepts a list of meal items (Arabic) and returns the TOTAL macros for the
// whole meal. Used by coaches when adding a meal to a client's plan.
const FULL_MEAL_PROMPT = `أنت خبير تغذية. يعطيك المستخدم قائمة مكونات وجبة واحدة (كل سطر مكوّن).
احسب إجمالي القيم الغذائية للوجبة كاملة (مجموع كل المكونات).
أرسل JSON فقط بدون أي نص آخر بهذا الشكل بالضبط:
{"calories":0,"protein":0,"carbs":0,"fat":0}`;

router.post("/analyze-full-meal", async (req: Request, res: Response): Promise<void> => {
  const { items } = req.body as { items?: string[] };
  const list = (items ?? []).map((s) => String(s).trim()).filter(Boolean);

  if (list.length === 0) {
    res.status(400).json({ error: "items required" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY not configured on server" });
    return;
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent":    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: FULL_MEAL_PROMPT },
          { role: "user",   content: list.join("\n") },
        ],
        temperature: 0.3,
        max_tokens:  200,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({} as any));
      res.status(response.status).json({ error: err?.error?.message ?? "Groq request failed" });
      return;
    }

    const data    = await response.json() as any;
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json({
      calories: Math.round(Number(parsed.calories) || 0),
      protein:  Math.round(Number(parsed.protein)  || 0),
      carbs:    Math.round(Number(parsed.carbs)    || 0),
      fat:      Math.round(Number(parsed.fat)      || 0),
    });
  } catch (err) {
    console.error("AI analyze-full-meal error:", err);
    res.status(500).json({ error: "Failed to analyze meal" });
  }
});

// ── POST /ai/exercise-info ─────────────────────────────────────────────────────
// Returns an Arabic description + execution steps + common mistakes for an
// exercise. Moved here from the frontend so the Groq key stays server-side.
// Body: { nameEn, muscleGroup }
router.post("/exercise-info", async (req: Request, res: Response): Promise<void> => {
  const { nameEn, muscleGroup } = req.body as { nameEn?: string; muscleGroup?: string };

  if (!nameEn?.trim()) {
    res.status(400).json({ error: "nameEn required" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY not configured on server" });
    return;
  }

  const prompt = `You are a fitness expert. Reply ONLY with a valid JSON object, no markdown, no explanation, no extra text before or after. Use Arabic language for all values.

Exercise: "${nameEn}" targeting "${muscleGroup ?? ""}"

Required JSON format (fill with real Arabic content):
{"description":"وصف مختصر للتمرين وماذا يستهدف بالضبط","steps":["الخطوة الأولى","الخطوة الثانية","الخطوة الثالثة","الخطوة الرابعة"],"mistakes":["الخطأ الأول","الخطأ الثاني","الخطأ الثالث"]}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent":    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role:    "system",
            content: "You are a fitness expert. You MUST reply with ONLY a valid JSON object. No markdown backticks, no preamble, no explanation. Just the raw JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens:  1000,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({} as any));
      res.status(response.status).json({ error: err?.error?.message ?? "Groq request failed" });
      return;
    }

    const data    = await response.json() as any;
    const content = (data.choices?.[0]?.message?.content ?? "").trim();

    // The model is told to return raw JSON, but be tolerant: try direct parse,
    // then a ```json``` fence, then the first {...} block.
    let parsed: any = null;
    try { parsed = JSON.parse(content); } catch { /* try next */ }
    if (!parsed) {
      const fenced = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (fenced) try { parsed = JSON.parse(fenced[1]); } catch { /* try next */ }
    }
    if (!parsed) {
      const braces = content.match(/\{[\s\S]*\}/);
      if (braces) try { parsed = JSON.parse(braces[0]); } catch { /* give up */ }
    }

    if (!parsed?.description || !parsed?.steps) {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    res.json({
      description: parsed.description,
      steps:       parsed.steps,
      mistakes:    parsed.mistakes ?? [],
    });
  } catch (err) {
    console.error("AI exercise-info error:", err);
    res.status(500).json({ error: "Failed to fetch exercise info" });
  }
});

export default router;
