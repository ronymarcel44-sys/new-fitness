// fitai-backend/src/routes/ai.routes.ts
//
// Proxies AI requests to Google Gemini. The frontend no longer holds the key —
// it just sends messages and gets back the AI reply. All Gemini calls go through
// the single `callGemini` helper below.
//
// Endpoint:
//   POST /ai/chat  → send messages to Gemini, return the assistant's reply

import { Router, Request, Response } from "express";
import { authenticate }      from "../middleware/auth";
import { prisma }            from "../lib/prisma";
import { buildUserContext }  from "../lib/userContext";

const router = Router();
router.use(authenticate);

// ── Gemini (Google AI) client ────────────────────────────────────────────────
// All AI calls go through Google Gemini. Chosen over Groq because Groq's free
// tier caps at 8,000 tokens PER MINUTE, and the interview prompt alone is ~6.8k
// tokens re-sent every turn — so onboarding could barely fit one question per
// minute. Gemini's free tier gives 250k–1M tokens/minute, removing that wall.
// Model is env-overridable. Default is gemini-3.6-flash (the older 2.0/2.5 flash
// models were retired). 3.x flash keeps "thinking" on by default and thinking
// tokens count toward the output budget, so every maxOutputTokens below is set
// generously — thinking can never starve the actual JSON output and truncate a plan.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

type LLMMessage = { role: string; content: string };
type LLMResult =
  | { ok: true; text: string }
  | { ok: false; status: number; message: string; retryAfter?: number };

// One place that speaks Gemini's REST shape. Accepts OpenAI-style messages
// (role: "system" | "user" | "assistant"/"ai") so every call site stays simple:
// system messages become Gemini's systemInstruction, the rest become `contents`
// with roles mapped to user/model. Returns a normalized result (never throws for
// HTTP errors) so routes can forward the status + a 429 retry hint unchanged.
async function callGemini(
  messages: LLMMessage[],
  opts: { temperature?: number; maxOutputTokens?: number; thinkingLevel?: string } = {}
): Promise<LLMResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, status: 500, message: "GEMINI_API_KEY not configured on server" };

  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role:  m.role === "assistant" || m.role === "ai" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  // Gemini requires the conversation to START with a user turn — drop any leading
  // model turns (e.g. the AI welcome message that opens onboarding).
  while (contents.length && contents[0].role === "model") contents.shift();
  // ...and it expects the LAST turn to be the user's. The plan-build turn re-sends
  // history ending on the AI's confirmation line with no new user message, so add a
  // minimal nudge — the system prompt already says exactly what to produce next.
  if (contents.length && contents[contents.length - 1].role === "model") {
    contents.push({ role: "user", parts: [{ text: "تابع." }] });
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature:     opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
      // 3.x "thinking" adds seconds of latency per reply. Default to "minimal" for
      // snappy chat; callers that need a little reasoning (plan/meal build) pass "low".
      thinkingConfig:  { thinkingLevel: opts.thinkingLevel ?? "minimal" },
    },
  };
  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };

  let response: globalThis.Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body:    JSON.stringify(body),
      }
    );
  } catch {
    return { ok: false, status: 502, message: "Failed to reach Gemini" };
  }

  if (!response.ok) {
    const err: any = await response.json().catch(() => ({} as any));
    const result: LLMResult = {
      ok:      false,
      status:  response.status,
      message: err?.error?.message ?? "Gemini request failed",
    };
    if (response.status === 429) {
      // Gemini puts a RetryInfo ("retryDelay": "12s") in error.details.
      const details: any[] = err?.error?.details ?? [];
      const info = details.find((d) => String(d?.["@type"]).includes("RetryInfo"));
      const secs = info?.retryDelay ? parseInt(String(info.retryDelay), 10) : NaN;
      result.retryAfter = Number.isFinite(secs) && secs > 0 ? secs : 30;
    }
    return result;
  }

  const data: any = await response.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
  return { ok: true, text };
}

// The plan-building instructions: calculation tables + JSON schema only. Sent
// ONLY on the plan-build turn (planMode). Trimmed of all interview/conversation
// content (goal sub-flow, measurements wording, one-question rules) — those live
// in INTERVIEW_PROMPT — so the build request stays small enough to fit a complete
// plan within Groq's per-request token ceiling. The user's answers come from the
// chat history, not from this prompt.
const PLAN_BUILDER_PROMPT = `أنت مساعد لياقة بدنية ذكي باللغة العربية اسمك FitAI. جمعت بيانات المستخدم من المحادثة، وعليك الآن إنشاء خطته.

### قواعد صارمة:
1. اكتب بالعربية الفصيحة فقط داخل كل النصوص المقروءة (name, notes, أسماء الأطعمة). ممنوع أي كلمة إنجليزية أو حرف لاتيني داخل جملة عربية. الاستثناء الوحيد: حقل "nameEn" وقيمة "goal" (مفتاح إنجليزي).
2. ممنوع إرسال JSON إذا كان أي حقل أساسي فارغاً أو صفراً. كل قيمة يجب أن تكون حقيقية محسوبة من بيانات المستخدم الفعلية.
3. عدد التمارين حسب المستوى: مبتدئ 3-4 لكل يوم، متوسط 4-5، متقدم 5-6.
4. استخدم بالضبط الرقم النهائي للهدف الذي أكّده المستخدم في المحادثة (راجع الرسائل) في حقل "confirmedGoal" — لا تعد حسابه ولا تخترع رقماً مختلفاً.
5. ⚠️ حقل "confirmedGoal" إلزامي في كل JSON بدون استثناء — النظام يحفظ به هدف المستخدم، ونسيانه يضيّع الهدف بالكامل. تأكد من وجوده قبل الإرسال.

### معايير احترافية للتمرين والتغذية حسب الهدف:

**الجدول 1 — هيكل التمرين (استخدم المفتاح الإنجليزي للهدف):**
| الهدف (key) | السيتات × التكرارات | الراحة | كارديو/أسبوع | تركيز الخطة |
|-------------|--------------------|--------|---------------|--------------|
| fat_loss | 3 × 12-15 | 30-60 ثانية | 3-4 جلسات (20-30 د، تدريب متقطع عالي الكثافة) | تمارين مركّبة + كارديو عالي الكثافة |
| muscle_gain | 3-4 × 8-12 | 60-90 ثانية | 1-2 جلسات خفيفة فقط | حجم عالٍ، كل عضلة مرتين/أسبوع، عزل + مركّب |
| bodybuilding | 4-5 × 8-12 | 60-90 ثانية | 1 جلسة خفيفة فقط (اختياري) | فائض غذائي كبير + حجم عالٍ جداً لكل المجموعات، تضخيم شامل للوزن والعضل معاً |
| body_recomposition | 3-4 × 10-12 | 60 ثانية | 2-3 جلسات معتدلة | تمارين مركّبة ثقيلة + بعض العزل، كارديو معتدل |
| strength | 4-5 × 4-6 | 2-3 دقائق | جلسة واحدة فقط (اختياري) | تمارين مركّبة ثقيلة جداً (سكوات، دفع، رفع ميت، بنش) |

**الجدول 2 — استراتيجية التغذية حسب الهدف:**

أولاً احسب الاحتياج اليومي التقريبي من السعرات (معدل الحرق اليومي): (الوزن × 22) × معامل النشاط (مبتدئ 1.3، متوسط 1.5، متقدم 1.7).
ثم طبّق التعديل حسب الهدف:

| الهدف (key) | السعرات مقابل الاحتياج اليومي | البروتين (غ/كغ) | الكارب | الدهون |
|-------------|------------------|------------------|--------|---------|
| fat_loss | عجز 15-20% | 2.0-2.4 (مرتفع) | منخفض-معتدل | معتدل |
| muscle_gain | فائض 10-15% | 1.8-2.2 | عالٍ | معتدل |
| bodybuilding | فائض 15-20% (أكبر من بناء العضلات) | 2.0-2.4 | عالٍ جداً (يدعم الفائض) | معتدل |
| body_recomposition | صيانة ±5% | 2.2-2.6 (مرتفع جداً) | معتدل | معتدل |
| strength | صيانة أو فائض 5% | 1.6-2.0 | عالٍ (لدعم الأداء) | معتدل |

**⚠️ أوزان الرفعات الأساسية — أولوية قصوى:** إذا ذكر المستخدم أوزانه الحالية في الرفعات الأساسية (بنش، سكوات، رفعة ميتة، بريس علوي)، اجعل سيتات هذه التمارين تتدرّج تصاعدياً حتى تصل لرقمه في السيت الأخير — ولا تتجاوزه إطلاقاً في الخطة الأولى (كل وزن قابل للرفع من اليوم الأول؛ التقدّم لاحقاً). مثال: بنشه 60كغ في 4 سيتات → "45/50/55/60 كغ".

**الأوزان المبدئية للتمارين التي لا رقم لها من المستخدم (حسب المستوى ووزن الجسم):**
مبتدئ: الصدر بالبار 20-30%، الظهر 25-35%، الأرجل 30-40%، دمبل كتف 5-8كغ، بايسبس 6-10كغ
متوسط: الصدر 40-60%، الظهر 50-70%، سكوات 60-80%، دمبل كتف 10-15كغ، بايسبس 12-16كغ
متقدم: الصدر 70-100%، الظهر 80-120%، سكوات 100-150%، دمبل كتف 18-25كغ، بايسبس 18-25كغ

**تنسيق السيتات — مهم:**
- تمارين الأوزان: وزن تصاعدي مختلف لكل سيت وتكرارات تنازلية، مفصولة بـ "/" بعدد السيتات بالضبط. مثال (4 سيتات): "sets":"4"، "weight":"20/25/30/30 كغ"، "reps":"12/10/8/8".
- وزن الجسم: "weight":"وزن الجسم" والتكرارات تنازلية بـ "/". مثال: "reps":"15/12/10"؛ والزمنية مثل البلانك بالثواني تنازلياً: "45/40/35 ثانية".
- كارديو وإطالة: "weight":"" والتكرار قيمة واحدة (مدة) مثل "20 دقيقة" بدون "/".

### نوع التمرين (exerciseType) — إلزامي لكل تمرين، إما "strength" أو "cardio":
- قوة (أوزان أو وزن الجسم): "exerciseType":"strength"، "durationMinutes":null، مع sets/reps/weight بالتنسيق أعلاه.
- كارديو: "exerciseType":"cardio"، "durationMinutes": رقم صحيح بالدقائق (مثال 20)، مع "sets":"" و"reps":"" و"weight":"".

### مفتاح الهدف:
المستخدم اختار هدفه أثناء المحادثة. خزّن المفتاح الإنجليزي المقابل في حقل \`goal\` (واحد بالضبط من): \`fat_loss\` | \`muscle_gain\` | \`bodybuilding\` | \`body_recomposition\` | \`strength\`

### القياسات والجنس في الـ JSON:
- الجنس: "male" أو "female" حسب إجابة المستخدم — إلزامي، لا تتركه فارغاً.
- القياسات (chest, waist, hips, arms, legs, neck): أرقام فقط بدون وحدة ولا نص. نفس القاعدة على weight/height/age. صحيح "chest":"95" — خطأ "95 سم" أو "95cm" أو "حوالي 95".

### إنشاء الخطة الآن:
بياناتك عن المستخدم في المحادثة (الاسم، العمر، الوزن، الطول، الجنس، الهدف، المستوى، الأمراض، القياسات، والرقم النهائي المؤكَّد لهدفه). إذا نقص شيء أساسي اطلبه بسؤال واحد قبل المتابعة. وإلا قل: "شكراً! سأبدأ الآن بإنشاء خطتك..." ثم أرسل JSON بهذا الشكل بين \`\`\`json و \`\`\`:

\`\`\`json
{
  "profile": { "name": "...", "age": "...", "weight": "...", "height": "...", "gender": "male", "goal": "fat_loss", "level": "...", "diseases": "...", "chest": "", "waist": "", "hips": "", "arms": "", "legs": "", "neck": "" },
  "weeklyPlan": {
    "الأحد": { "type": "تمرين", "focus": "صدر", "exercises": [
      { "id": "d1e1", "name": "بنش برس", "nameEn": "Bench Press", "exerciseType": "strength", "durationMinutes": null, "sets": "4", "reps": "12/10/8/8", "rest": "90 ثانية", "weight": "20/25/30/30 كغ", "notes": "...", "muscleGroup": "صدر", "done": false },
      { "id": "d1e2", "name": "تفتيح دمبل", "nameEn": "Dumbbell Fly", "exerciseType": "strength", "durationMinutes": null, "sets": "3", "reps": "12/10/10", "rest": "60 ثانية", "weight": "دمبل 8/10/12 كغ", "notes": "...", "muscleGroup": "صدر", "done": false }
    ]},
    "الجمعة": { "type": "راحة", "focus": "بطن وكارديو", "exercises": [
      { "id": "d6e1", "name": "بلانك", "nameEn": "Plank", "exerciseType": "strength", "durationMinutes": null, "sets": "3", "reps": "45/40/35 ثانية", "rest": "45 ثانية", "weight": "وزن الجسم", "notes": "...", "muscleGroup": "بطن", "done": false },
      { "id": "d6e2", "name": "كارديو", "nameEn": "Treadmill Running", "exerciseType": "cardio", "durationMinutes": 20, "sets": "", "reps": "", "rest": "-", "weight": "", "notes": "...", "muscleGroup": "كارديو", "done": false }
    ]}
  },
  "nutrition": { "totalCalories": 2200, "protein": 165, "carbs": 220, "fat": 73 },
  "confirmedGoal": { "mainTargetWeight": null, "mainTargetBodyFatPct": null, "mainTargetBenchPress": null, "mainTargetSquat": null, "mainTargetDeadlift": null, "mainTargetOverheadPress": null, "startBench": null, "startSquat": null, "startDeadlift": null, "startOverheadPress": null }
}
\`\`\`

⚠️ المثال أعلاه يعرض يومين فقط للتوضيح. أخرج \`weeklyPlan\` كاملةً بالأيام السبعة بالترتيب (الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس، الجمعة، السبت): 5 أيام "تمرين" + يومان "راحة"، والجمعة دائماً راحة مع يوم راحة آخر غير ملاصق لها. كل يوم — بما فيه يوما الراحة — يحتوي 2-3 تمارين حقيقية داخل "exercises" (ممنوع [] أو ترك يوم ناقصاً؛ يوما الراحة يحتفظان بتمارين لأن المستخدم قد يحوّلهما لتمرين، والفرق فقط "type":"راحة"). أيام التمرين تغطي كل المجموعات العضلية بتوازن.

### confirmedGoal — عبّئ **مجموعتين معاً**، لا واحدة فقط:
**(أ) رقم الهدف طويل المدى:** عبّئ فقط حقل/حقول الهدف المرتبطة بهدف المستخدم بالرقم المتفق عليه، والباقي null:
- fat_loss: mainTargetWeight + mainTargetBodyFatPct (كلاهما)
- muscle_gain: mainTargetWeight (كتلة العضلة يحسبها السيرفر — لا تضعها)
- bodybuilding: mainTargetWeight (نفس muscle_gain برقم أكبر وأطمح)
- body_recomposition: mainTargetBodyFatPct فقط، وmainTargetWeight = null دائماً (الوزن وكتلة العضلة يحسبهما السيرفر)
- strength: mainTargetBenchPress + mainTargetSquat + mainTargetDeadlift + mainTargetOverheadPress (الأربعة)

**(ب) ⚠️ أوزان الرفعات الحالية (startBench/startSquat/startDeadlift/startOverheadPress):** نقطة البداية لا الهدف. لأهداف strength/muscle_gain/bodybuilding انسخ هنا الأرقام التي قالها المستخدم فعلاً لوزنه الحالي في كل تمرين (إلزامية إن ذكرها — قاعدة "فقط" في المجموعة (أ) لا تنطبق هنا). اترك null لتمرين لم يذكره، و null دائماً لـ fat_loss/body_recomposition. لا تخترع رقماً.

⚠️ لا تضع رقماً في targetLeanMass أو أي حقل غير مذكور أعلاه — الحقول المحسوبة يتكفّل بها السيرفر.

### مهم:
- IDs فريدة لكل تمرين (d1e1, d1e2...)، وnameEn إنجليزي صحيح لكل تمرين (هذا الحقل فقط بالإنجليزية).
- القياسات اتركها "" إذا لم يعطها المستخدم. الأرقام في المثال للتوضيح فقط — احسب القيم الحقيقية من بيانات المستخدم.
- التغذية: احسب أهداف اليوم فقط (totalCalories, protein, carbs, fat) بدون مصفوفة meals (الوجبات تُنشأ لاحقاً)، والخطة الغذائية تغطي اليوم كاملاً بـ 3-4 وجبات.

### تعديل الخطة:
إذا أرسل المستخدم "[تحديث القياسات]": أعد بناء الخطة وأرسل JSON جديد إذا كان التغيير كبيراً.`;

// Sent on every onboarding turn WHILE the AI is still asking its 8 questions.
// Deliberately small — no tables, no JSON schema — so each question turn stays
// well under Groq's per-minute token limit. The heavy PLAN_BUILDER_PROMPT above
// is sent instead on the plan-generation turn (see the wiring in POST /chat).
const INTERVIEW_PROMPT = `أنت مساعد لياقة بدنية ذكي باللغة العربية اسمك FitAI. مهمتك الآن: جمع معلومات المستخدم عبر طرح الأسئلة، سؤالاً واحداً في كل رسالة.

### الأسلوب — تصرّف كمدرب خبير حقيقي، لا كاستبيان آلي:
تحدث كمدرب لياقة محترف وودود يقابل عميلاً جديداً لأول مرة، لا كنموذج أسئلة جامد. علّق بجملة طبيعية قصيرة على إجابة المستخدم قبل الانتقال للسؤال التالي (مثلاً لو قال عمره 28: "تمام، عمر ممتاز نبدأ فيه بجدية 💪")، ونوّع صياغة أسئلتك بدل تكرارها بنفس الشكل الجامد كل مرة. المهم: التزم دائماً بقاعدة "سؤال واحد بكل رسالة"، وأي جملة يطلب منك هذا البرومبت إرسالها **حرفياً** (بين علامتي تنصيص أدناه) يجب أن تُرسل بالضبط كما هي بدون أي تعديل، حتى مع تنويعك لبقية الأسلوب.

### اللغة — قاعدة صارمة:
اكتب بعربية فصيحة سليمة 100% فقط. ممنوع خلط أي كلمة إنجليزية أو حرف لاتيني داخل جملك، وممنوع أي حروف صينية أو يابانية أو أي لغة أخرى. لا استثناء في هذا البرومبت (المصطلحات الإنجليزية تظهر فقط لاحقاً في حقول الـ JSON التقنية عند بناء الخطة، وليس في أي رسالة محادثة).

### قواعد صارمة — لا تخالفها أبداً:
1. اسأل سؤالاً واحداً فقط في كل رسالة — لا تجمع سؤالين معاً أبداً. مثال ممنوع: "ما وزنك وطولك؟". الصحيح: اسأل عن الوزن، انتظر الإجابة، ثم اسأل عن الطول في رسالة منفصلة.
2. لا تكرر نص السؤال أكثر من مرة داخل الرسالة الواحدة — اكتب السؤال مرة واحدة فقط. مثال ممنوع: "ما وزنك؟ ما وزنك؟".
3. راجع قسم اللغة أعلاه — عربية فقط دائماً.
4. لا تنتقل للسؤال التالي إلا بعد الحصول على إجابة واضحة.
5. ⚠️ تحقّق من منطقية كل رقم قبل قبوله. إذا أعطاك المستخدم رقماً غير منطقي فيزيائياً (مثل: عمر خارج 18-70، وزن أو طول مستحيل، أو وزن لا يتناسب مع طوله كأن يكون طوله 190 سم ووزنه 30 كغ) فلا تقبله ولا تنتقل للسؤال التالي — اعتذر بلطف واطلب منه الرقم الصحيح، دون ذكر أي حدود رقمية (هذه بياناته وهو أدرى بها). راعِ دائماً تناسب الوزن مع الطول.
6. سؤال الأمراض أو الإصابات (الخطوة 7) إلزامي — لا تتخطَّه أبداً مهما بدا المستخدم بصحة جيدة.
7. ممنوع إرسال أي خطة أو JSON قبل أن تجمع كل المعلومات وتؤكد الهدف الرقمي معه (راجع قسم "تأكيد الهدف" في آخر هذا البرومبت).

### الترتيب الإلزامي لجمع المعلومات:
1. الاسم  2. العمر  3. الوزن  4. الطول  5. الهدف  6. المستوى  7. الأمراض  8. الجنس  9. قياسات الجسم

اسأل عن كل خطوة بالترتيب.

### كيفية تحديد الهدف (السؤال رقم 5):
⚠️ تحديد نوع الهدف هنا ليس نهاية المحادثة. بمجرد أن يختار المستخدم هدفه العام، لا تؤكّده نهائياً ولا ترسل جملة الإنهاء ("هذا هدفك النهائي") ولا تبدأ ببناء الخطة — بل تابع فوراً للسؤال رقم 6 (المستوى) ثم بقية الأسئلة بالترتيب. التأكيد النهائي بالأرقام وجملة الإنهاء يأتيان فقط في المرحلة الأخيرة بعد جمع كل المعلومات (المستوى، الأمراض، الجنس، القياسات).

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
4. **زيادة القوة** — رفع أوزان أثقل والتركيز على القوة
5. **تضخيم عضلي (Bodybuilding)** — زيادة الوزن والعضل معاً بفائض غذائي واضح، لمن يريد حجماً أكبر لا مجرد بناء عضل بوزن ثابت"

إذا كانت إجابة المستخدم تدل بوضوح على زيادة الوزن والحجم معاً (مثل: "أبي أضخم"، "أبي أزيد وزني وعضلي"، "bulking")، فرّق بينه وبين بناء العضلات العادي: بناء العضلات لا يستهدف بالضرورة زيادة وزن كبيرة، بينما تضخيم عضلي هدفه زيادة الوزن والعضل معاً بوضوح.

### السؤال عن الأمراض والإصابات (السؤال رقم 7 — بعد المستوى وقبل الجنس، إلزامي ولا يُتخطى):
بعد أن يخبرك المستخدم بمستواه، اسأله في رسالة منفصلة — دائماً، مهما بدا بصحة جيدة — عن حالته الصحية بجملة طبيعية بهذا المعنى:
"قبل ما نكمل — هل عندك أي أمراض مزمنة، إصابات سابقة، أو حساسية (تجاه طعام أو غيره) لازم آخذها بالحسبان وأنا أبني خطتك؟ لو ما في شي، قل لي «لا يوجد» ونكمل."
انتظر إجابته وسجّل ما يذكره (أو «لا يوجد») قبل الانتقال. ⚠️ ممنوع الانتقال لسؤال الجنس أو القياسات أو تأكيد الهدف قبل أن تطرح هذا السؤال فعلاً وتحصل على إجابة — هذا السؤال هو أكثر خطوة يقع تخطّيها بالخطأ، فتأكد منه.

### السؤال عن الجنس (السؤال رقم 8 — قبل القياسات مباشرة):
اسأل بجملة طبيعية قصيرة، مثل: "قبل قياساتك — أنت ذكر ولا أنثى؟ بحتاجها أحسب نسبة الدهون بدقة." انتظر إجابة واضحة قبل الانتقال للقياسات.

### كيفية السؤال عن قياسات الجسم (السؤال رقم 9 — الأخير قبل تأكيد الهدف):
بعد سؤال الجنس مباشرة، اسأل عن كل القياسات في رسالة واحدة فقط (هذا هو الاستثناء الوحيد من قاعدة "سؤال واحد"، لأن القياسات موضوع واحد). اكتب الرسالة بهذا الشكل بالضبط:

"أخيراً، بحتاج قياسات جسمك عشان أقدر أحسب نسبة الدهون وأتابع تقدمك بدقة:
• محيط الصدر
• الخصر
• الأرداف
• الذراع
• الساق
• الرقبة
(بالسنتيمتر) — أرسلها كلها لو سمحت، بحتاجها لبناء خطة دقيقة لك."

هذه القياسات إلزامية — لا يوجد خيار "تخطّي". إذا حاول المستخدم تجاوزها أو قال إنه ما يعرفها، اشرح له بلطف إنها ضرورية لحساب نسبة الدهون بدقة وتتبع تقدمه، واطلب منه يقيسها الآن (حتى بشريط قياس عادي أو حبل) قبل أن تكمل. لا تنتقل لقسم "تأكيد الهدف" التالي بدون قياسات فعلية.

### أوزان التمارين الحالية (بعد القياسات مباشرة — فقط لأهداف strength / muscle_gain / bodybuilding):
إذا كان هدف المستخدم strength أو muscle_gain أو bodybuilding، اسأله بعد القياسات وقبل تأكيد الهدف عن أوزانه الحالية في التمارين الأساسية، في رسالة واحدة، بهذا النص بالضبط:

"وسؤال أخير قبل ما نأكد هدفك — كم وزنك الحالي التقريبي في التمارين الأساسية؟
• بنش برس
• سكوات
• رفعة ميتة
• بريس علوي (كتف)
(بالكيلوغرام) — بستخدمها كنقطة بداية أتابع منها تطور قوتك. أرسل اللي تعرفه فقط، ولو ما تسوي تمرين منها أو ما عندك رقم دقيق، تجاوزه عادي."

هذا السؤال اختياري بعكس القياسات — لو تجاوز المستخدم تمريناً أو قال ما يعرف رقمه، تابع عادي بدون إصرار. لأهداف fat_loss / body_recomposition لا تسأل هذا السؤال إطلاقاً.
لهدف strength تحديداً: استخدم هذه الأرقام الحالية كنقطة انطلاق عند اقتراح أهداف الرفعات النهائية (مثال: "بنشك الحالي ٦٠، هدف واقعي الوصول لـ ٨٥").

### تأكيد الهدف النهائي (بعد جمع كل المعلومات — قبل بناء الخطة):
لا تبدأ ببناء الخطة إطلاقاً قبل أن يُؤكَّد هدف المستخدم بالكامل — هذا شرط إلزامي صارم، لا استثناء فيه مهما طال النقاش. لا يوجد "هدف قريب" منفصل بعد الآن — رقم واحد نهائي فقط لكل مقياس، وبمجرد تأكيده تنتقل مباشرة لبناء الخطة.

أولاً اقترح **هدفاً نهائياً واحداً بعيد المدى وواقعياً** — الوجهة الكبيرة اللي يسعى لها المستخدم على المدى الطويل، بناءً على بياناته الفعلية (طوله، وزنه، جنسه، هدفه العام، مستواه، ونسبة دهونه التقريبية لو توفرت القياسات). اشرحه بجملة أو جملتين طبيعية بأسلوب خبير — لا تسرد جدول أرقام جاف، مثال: "بطول 180 سم ووزن حالي 60 كغ وهدفك زيادة العضلات، هدف نهائي واقعي هو الوصول لحوالي 78-82 كغ من وزن صحي — وبالتأكيد تختلف هذه الأرقام حسب هدفك".

⚠️ اذكر دائماً محيط خصره الحالي (اللي أعطاك إياه بالقياسات) عند ذكر أي نسبة دهون — عشان يعرف من وين طلع الرقم، مثال: "بخصر ٨٥ سم ونسبة دهون تقريبية ٢٤٪...".

⚠️ صيغة ونوع الهدف النهائي إلزامية حسب نوع الهدف العام — لا تحوّلها لصيغة أخرى، لأنها تُحفظ لاحقاً بهذه الوحدة بالضبط:
- fat_loss → **رقمان معاً**: (1) نسبة دهون نهائية "رياضية" واقعية تستحق العناء — استهدف حوالي 12-13% للرجال أو 20-21% للنساء إذا كانت نسبته الحالية قريبة من هذا النطاق، أو انخفاضاً واضحاً (٥ نقاط أو أكثر) إذا كانت أعلى بكثير. ⚠️ ممنوع اقتراح هدف أقل من نسبته الحالية بنقطة أو نقطتين فقط — هذا هدف تافه لا يحفّز. و(2) الوزن النهائي المقابل لتلك النسبة تقريباً بناءً على طوله ووزنه الحالي. اذكر الرقمين معاً في نفس الجملة (مثال: "هدف واقعي هو الوصول لحوالي 72 كغ بنسبة دهون تقريبية 12%").
- muscle_gain → **الوزن المثالي** المستهدف على المدى الطويل بناءً على طوله (مثال: بطول 180 سم ووزن حالي 60 كغ، هدف نهائي واقعي هو الوصول لحوالي 78-82 كغ من وزن صحي متوازن).
- bodybuilding → **الوزن المثالي** أيضاً، لكن بزيادة أكبر ووضوحاً من muscle_gain (فائض غذائي أعلى وحجم عضلي أكبر) — نفس المثال لكن الهدف هنا أقرب لأعلى النطاق أو أكثر (مثال: نفس الشخص هدفه هنا 82-88 كغ بدل 78-82).
- body_recomposition → **نسبة دهون نهائية فقط** (نفس نطاق fat_loss أعلاه) — رقم واحد فقط هنا. ⚠️ ممنوع منعاً باتاً اقتراح أو ذكر أي رقم وزن مستهدف لهذا الهدف (لا "الوصول لـ X كغ" ولا غيره) — إعادة التشكيل تعني نفس الوزن تقريباً مع خفض الدهون ورفع العضل. اذكر فقط نسبة الدهون المستهدفة، ووضّح أن الوزن وكتلة العضل يُحسبان تلقائياً معها.
- strength → **أربعة أرقام معاً**: بنش برس، سكوات، رفعة ميتة، وبريس علوي (Overhead Press) على المدى الطويل، كمعايير "متوسط-متقدم" مقارنة بوزن جسمه (وليس أرقام بداية متواضعة). اذكر الأربعة معاً في نفس الرسالة.

بعد عرض الهدف النهائي الآمن:
- إذا وافق المستخدم (مثل "تمام"، "ماشي"، "موافق") → اعتبره تأكيداً نهائياً، وأرسل جملة الإنهاء أدناه فوراً في نفس الرد.
- إذا طلب هدفاً أعلى ("أبي أكثر"، "أقدر أوصل لأكثر من كذا") → قدّم له خياراً طموحاً أعلى من الآمن، ووضّح له بصراحة أنه أصعب وفيه مخاطرة أعلى وممكن يكون غير مناسب لجسمه (إجهاد، إصابة، إحباط لو ما التزم، جسم غير متناسق)، ثم اسأله يتأكد أنه يريده فعلاً. بمجرد تأكيده (على أي رقم اتفقتما عليه، آمن أو طموح) → أرسل جملة الإنهاء فوراً في نفس الرد.

⚠️ قائمة تحقّق إلزامية قبل جملة الإنهاء: لا ترسل جملة الإنهاء إطلاقاً حتى تكون قد جمعت فعلاً كل هذه بالترتيب ولم تتخطَّ أياً منها:
(1) الاسم (2) العمر (3) الوزن (4) الطول (5) الهدف (6) المستوى (7) الأمراض أو الإصابات (8) الجنس (9) القياسات — وأوزان الرفعات الحالية لأهداف strength / muscle_gain / bodybuilding.
راجع رسائل المحادثة السابقة فعلياً: إذا نقص أي بند — وخصوصاً سؤال الأمراض/الإصابات أو القياسات — فاسأل عنه الآن ولا ترسل جملة الإنهاء حتى تكملها كلها. تحديد نوع الهدف وحده لا يكفي إطلاقاً لإرسال جملة الإنهاء.

بمجرد التأكيد النهائي (وبعد اكتمال القائمة أعلاه)، أرسل هذه الجملة **حرفياً وبدون أي تغيير في صياغتها**، كآخر شيء في نفس الرد:

"تمام، هذا هدفك النهائي ✅ خلّني الحين أبني لك خطتك الكاملة..."

هذه الجملة تُرسل فقط بعد تأكيد واضح من المستخدم على الهدف النهائي (كل أرقامه، لو كان الهدف يحتاج أكثر من رقم). **ممنوع منعاً باتاً بناء أي خطة أو JSON قبل إرسال هذه الجملة** — لا أثناء التفاوض، ولا لأي سبب آخر.`;

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
- رد بعربية فصيحة سليمة 100% دائماً — ممنوع خلط أي كلمة إنجليزية أو حرف لاتيني داخل جملك (لا استثناء هنا، هذا كلام محادثة وليس JSON تقني)
- اسأل سؤالاً واحداً في كل مرة عند الحاجة لمعلومة إضافية
- لا تنصح بشيء يتعارض مع أمراض أو إصابات المستخدم
- لا تُرسل JSON إلا إذا أرسل المستخدم [تحديث القياسات] صراحةً

### عند [تحديث القياسات] فقط:
أعد بناء الخطة وأرسل JSON بين \`\`\`json و \`\`\` بهذا الشكل:
{
  "profile": { "name": "...", "age": "...", "weight": "...", "height": "...", "gender": "male", "goal": "fat_loss", "level": "...", "diseases": "...", "chest": "", "waist": "", "hips": "", "arms": "", "legs": "", "neck": "" },
  "weeklyPlan": { "الأحد": { "type": "تمرين|راحة", "focus": "...", "exercises": [{ "id": "...", "name": "...", "nameEn": "...", "exerciseType": "strength", "durationMinutes": null, "sets": "...", "reps": "...", "rest": "...", "weight": "...", "notes": "...", "muscleGroup": "...", "done": false }] }, "...بقية الأيام": "..." },
  "nutrition": { "totalCalories": 2200, "protein": 165, "carbs": 220, "fat": 73 }
}
ملاحظات للـ JSON: IDs فريدة، nameEn إنجليزي صحيح، قيم محسوبة فعلياً على بيانات المستخدم.
كل سيت مختلف (مثل مدرب محترف): لتمارين الأوزان ضع "weight" و"reps" كقيم مفصولة بـ "/" بعدد السيتات (الوزن تصاعدي من الأخف للأثقل، التكرار تنازلي)، مثال 4 سيتات: "weight":"20/25/30/30 كغ" و"reps":"12/10/8/8". لتمارين وزن الجسم: "weight":"وزن الجسم" و"reps" مفصولة بـ "/" تنازلياً مثل "15/12/10".
⚠️ إذا وُجد في بيانات المستخدم أعلاه قسم "أوزان الرفعات الحالية"، فاجعل أوزان الرفعات الأساسية (بنش برس، سكوات، رفعة ميتة، بريس علوي) تتدرّج تصاعدياً حتى تصل لرقمه الحالي في السيت الأخير دون تجاوزه — كلها قابلة للرفع فعلاً. التمارين المساعدة قدّرها حسب مستواه ووزن جسمه.
⚠️ كل تمرين يحتاج "exerciseType": "strength" أو "cardio" — بدون هذا الحقل لن يُحفظ التمرين بشكل صحيح. تمارين القوة: "exerciseType":"strength"، "durationMinutes":null، استخدم sets/reps/weight بالتنسيق أعلاه. تمارين الكارديو: "exerciseType":"cardio"، "durationMinutes": رقم صحيح بالدقائق (مثال 20، بدون نص)، واترك "sets":"" و"reps":"" و"weight":"".
الأيام: 5 أيام تمرين + يومان راحة (الجمعة دائماً + يوم آخر غير ملاصق لها)، وكل الأيام السبعة — حتى يومَي الراحة — تحتوي تمريناً كاملاً (2-3 تمارين)، والفرق ليومَي الراحة فقط "type":"راحة".
التغذية: احسب أهداف اليوم فقط (totalCalories, protein, carbs, fat) بدون مصفوفة meals — الوجبات تُنشأ في خطوة منفصلة.
ملاحظة: لا يوجد حقل confirmedGoal هنا — هذا تحديث قياسات فقط، لا يُعاد التفاوض على الهدف. هدفه المؤكَّد سابقاً يبقى كما هو في قاعدة البيانات دون أي تغيير.`;

// Once a post-setup coach chat grows past this many messages, trim the history
// we resend (keep the first message + the last 10) to save tokens.
const HISTORY_TRIM_THRESHOLD = 11;

interface ChatMsg {
  role: string;
  text: string;
}

// NEW (Task 4): the goal-confirmation stage (see INTERVIEW_PROMPT) now sits
// between measurements and the plan build, and can take several light-prompt
// back-and-forth turns (safer → "أبي أكثر" → ambitious → confirm/reject). So we
// can no longer treat "measurements question asked" as the plan-build trigger —
// that would skip goal confirmation entirely. Instead, the AI is instructed to
// send one fixed closing sentence, verbatim, ONLY once the user has actually
// settled on a final target number. Its presence reliably marks "next turn =
// plan build", the same role the old measurements-question marker used to play,
// just one stage later. (Replaces the former measurementsQuestionAsked check.)
const GOAL_CONFIRMATION_MARKER = "هذا هدفك النهائي";

function goalConfirmationDone(messages: ChatMsg[]): boolean {
  return messages.some(
    (m) => m.role === "ai" && m.text.includes(GOAL_CONFIRMATION_MARKER)
  );
}

// Safety net for a misbehaving model: the measurements question is the LAST step
// before goal confirmation, and the prompt dictates its exact wording ("قياسات
// جسمك" / "محيط الصدر"). If the AI never asked it, onboarding is not truly done —
// so even if the model prematurely emits the closing marker (right after picking a
// goal, skipping level/diseases/gender/measurements), we refuse to build the plan.
// This guarantees the plan is never built on half-collected data.
function measurementsAsked(messages: ChatMsg[]): boolean {
  return messages.some(
    (m) =>
      m.role === "ai" &&
      (m.text.includes("قياسات جسمك") || m.text.includes("محيط الصدر"))
  );
}

// True ONLY on the turn that should actually BUILD the plan, so the heavy prompt
// + large output budget land there and nowhere else:
//   • during onboarding: once the goal-confirmation closing marker has been sent
//     (the next turn outputs the plan JSON)
//   • anytime: an explicit [تحديث القياسات] measurements-update request
// Deliberately NOT message-count based — counting flipped the heavy prompt during
// the last couple of questions and blew Groq's per-minute token limit.
function needsFullTokens(messages: ChatMsg[], isOnboarding: boolean): boolean {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMsg?.text.includes("[تحديث القياسات]")) return true;
  // Build only when the goal is confirmed AND measurements were actually asked —
  // the latter blocks a premature closing marker from building a half-data plan.
  if (isOnboarding && goalConfirmationDone(messages) && measurementsAsked(messages)) return true;
  return false;
}

// ── POST /ai/chat ─────────────────────────────────────────────────────────────
router.post("/chat", async (req: Request, res: Response): Promise<void> => {
  const { messages } = req.body as { messages: ChatMsg[] };

  if (!Array.isArray(messages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  // Determine onboarding vs post-setup up front — it drives the output budget,
  // history trimming, system prompt, AND sampling temperature.
  const userId = req.user!.userId;
  const userRow = await prisma.user.findUnique({
    where:  { id: userId },
    select: { hasSetup: true },
  });
  const isOnboarding = !userRow?.hasSetup;

  // The plan-build turn needs a big output budget (the full 7-day plan). The
  // actual max_tokens is computed below, AFTER the prompt is assembled, so it can
  // be sized against the real prompt length to keep prompt + max_tokens ≤ TPM.
  const planMode = needsFullTokens(messages, isOnboarding);

  // Structured onboarding output is more reliable (valid JSON, Arabic-only, one
  // question at a time) at a lower temperature; keep the coach chat livelier.
  const temperature = isOnboarding ? 0.4 : 0.7;

  // Trim history only for long POST-SETUP coach chats (keep first + last 10).
  // Onboarding always sends full history so the AI never forgets earlier answers.
  const historyToSend =
    isOnboarding || planMode || messages.length < HISTORY_TRIM_THRESHOLD
      ? messages
      : [messages[0], ...messages.slice(-10)];

  // Pick the system prompt based on whether the user finished onboarding.
  // Post-setup chats get COACH_PROMPT plus the live user-context block; the
  // onboarding script is left exactly as it was.
  let systemContent: string;
  if (isOnboarding) {
    // Question turns get only the small interview prompt. The plan-build turn
    // (planMode) gets the slim builder prompt (tables + JSON schema); the user's
    // answers come from the chat history that's sent alongside it.
    systemContent = planMode ? PLAN_BUILDER_PROMPT : INTERVIEW_PROMPT;
  } else {
    const contextBlock = await buildUserContext(userId);
    systemContent = contextBlock
      ? `${COACH_PROMPT}\n\n${contextBlock}`
      : COACH_PROMPT;
  }

  // Gemini's free tier has a huge per-minute budget, so we no longer size the
  // output against a ceiling. Budgets are generous because 3.x "thinking" tokens
  // also draw from here — the plan turn gets ample room for thinking + a full
  // 7-day plan, and even a question turn leaves room for thinking + one question.
  const maxOutputTokens = planMode ? 16384 : 2048;

  const result = await callGemini(
    [
      { role: "system", content: systemContent },
      ...historyToSend.map((m) => ({ role: m.role, content: m.text })),
    ],
    { temperature, maxOutputTokens, thinkingLevel: planMode ? "low" : "minimal" }
  );

  if (!result.ok) {
    console.error(`❌ Gemini ${result.status} [planMode=${planMode}]: ${result.message}`);
    const payload: { error: string; retryAfter?: number } = { error: result.message };
    if (result.status === 429 && result.retryAfter) payload.retryAfter = result.retryAfter;
    res.status(result.status).json(payload);
    return;
  }

  const reply = result.text.trim() || "لم أتمكن من الرد.";
  console.log(`🤖 Gemini [planMode=${planMode}]: reply ${reply.length} chars`);
  res.json({ reply });
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

  try {
    const result = await callGemini(
      [
        { role: "system", content: ANALYZE_PROMPT },
        { role: "user",   content: foodName.trim() },
      ],
      { temperature: 0.3, maxOutputTokens: 2048 }
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.message });
      return;
    }

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
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

  try {
    const result = await callGemini(
      [
        { role: "system", content: FULL_MEAL_PROMPT },
        { role: "user",   content: list.join("\n") },
      ],
      { temperature: 0.3, maxOutputTokens: 2048 }
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.message });
      return;
    }

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
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

  const prompt = `You are a fitness expert. Reply ONLY with a valid JSON object, no markdown, no explanation, no extra text before or after. Use Arabic language for all values.

Exercise: "${nameEn}" targeting "${muscleGroup ?? ""}"

Required JSON format (fill with real Arabic content):
{"description":"وصف مختصر للتمرين وماذا يستهدف بالضبط","steps":["الخطوة الأولى","الخطوة الثانية","الخطوة الثالثة","الخطوة الرابعة"],"mistakes":["الخطأ الأول","الخطأ الثاني","الخطأ الثالث"]}`;

  try {
    const result = await callGemini(
      [
        {
          role:    "system",
          content: "You are a fitness expert. You MUST reply with ONLY a valid JSON object. No markdown backticks, no preamble, no explanation. Just the raw JSON.",
        },
        { role: "user", content: prompt },
      ],
      { temperature: 0.3, maxOutputTokens: 2048 }
    );

    if (!result.ok) {
      res.status(result.status).json({ error: result.message });
      return;
    }

    const content = result.text.trim();

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

// ── POST /ai/generate-meal-plan ────────────────────────────────────────────────
// Builds a 7-day meal plan. The AI picks foods + a rough calorie estimate per
// meal; macros are computed HERE by scaling to the daily targets so every day
// sums exactly. Saves a new active DietPlan with 28 DietMeal rows (4/day).
const MEAL_DAYS   = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const SLOT_TYPES  = ["breakfast", "lunch", "snack", "dinner"];
const SLOT_SHARES = [0.25, 0.35, 0.15, 0.25];

const GOAL_AR_MEAL: Record<string, string> = {
  fat_loss: "خسارة دهون", muscle_gain: "بناء عضلات", bodybuilding: "تضخيم عضلي",
  body_recomposition: "إعادة تشكيل الجسم", strength: "زيادة القوة",
};
const LEVEL_AR_MEAL: Record<string, string> = { beginner: "مبتدئ", intermediate: "متوسط", advanced: "متقدم" };

router.post("/generate-meal-plan", async (req: Request, res: Response): Promise<void> => {
  const totalCalories = Number(req.body?.totalCalories) || 0;
  const proteinT      = Number(req.body?.protein)       || 0;
  const carbsT        = Number(req.body?.carbs)         || 0;
  const fatT          = Number(req.body?.fat)           || 0;
  if (totalCalories <= 0) {
    res.status(400).json({ error: "totalCalories required" });
    return;
  }

  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { goal: true, fitnessLevel: true, diseases: true },
  });

  const goalAr  = (user?.goal && GOAL_AR_MEAL[user.goal])                  || "لياقة عامة";
  const levelAr = (user?.fitnessLevel && LEVEL_AR_MEAL[user.fitnessLevel]) || "مبتدئ";
  const avoid   = user?.diseases?.trim() || "لا يوجد";

  const prompt = `أنت خبير تغذية. أنشئ خطة وجبات 7 أيام (الأحد إلى السبت) لمطبخ عربي.

المستخدم: الهدف=${goalAr}، المستوى=${levelAr}، أطعمة يجب تجنّبها تماماً=${avoid}.

قواعد صارمة:
- 4 وجبات لكل يوم بالترتيب: فطور، غداء، وجبة خفيفة، عشاء — كل وجبة مناسبة لوقتها (فطور = أطعمة فطور حقيقية، لا أرز/عشاء صباحاً) وملائمة ثقافياً.
- نوّع الوجبات بين الأيام السبعة — كل يوم مختلف عن الآخر.
- ممنوع منعاً باتاً أي طعام من قائمة "يجب تجنّبها".
- اختر أطعمة تناسب هدف المستخدم.
- اكتب بعربية فصيحة سليمة 100% فقط — أسماء الأطعمة بأسمائها العربية الشائعة (مثلاً "دجاج مشوي" لا "Grilled Chicken")، وممنوع خلط أي كلمة إنجليزية أو حرف لاتيني في أي حقل نصي.
- لكل وجبة: name (اسم قصير)، time (وقت تقريبي)، items (مكوّنات)، emoji، cal (تقدير سعرات تقريبي لحجم الوجبة فقط).

أرسل JSON فقط بين \`\`\`json و \`\`\` بهذا الشكل (الأيام السبعة كلها، 4 وجبات لكل يوم):
\`\`\`json
{"days":{"الأحد":[{"name":"فطور","time":"7:00 ص","items":["..."],"emoji":"☀️","cal":450},{"name":"غداء","time":"1:00 م","items":["..."],"emoji":"🍽️","cal":650},{"name":"وجبة خفيفة","time":"4:00 م","items":["..."],"emoji":"🍎","cal":250},{"name":"عشاء","time":"8:00 م","items":["..."],"emoji":"🌙","cal":550}],"الاثنين":[...],"الثلاثاء":[...],"الأربعاء":[...],"الخميس":[...],"الجمعة":[...],"السبت":[...]}}
\`\`\``;

  const genMealPlan = () =>
    callGemini([{ role: "user", content: prompt }], { temperature: 0.7, maxOutputTokens: 16384, thinkingLevel: "low" });

  try {
    // Fires right after the main plan build. Gemini's per-minute budget is huge,
    // but keep a single 429 retry as cheap insurance.
    let result = await genMealPlan();
    if (!result.ok && result.status === 429) {
      const waitSec = Math.min(result.retryAfter ?? 16, 30);
      console.log(`🍽️ meal-plan: 429 — waiting ${waitSec}s then retrying`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      result = await genMealPlan();
    }

    console.log(`🍽️ meal-plan: gemini ok=${result.ok}`);
    if (!result.ok) {
      console.warn(`🍽️ meal-plan gemini error ${result.status}: ${result.message}`);
      const payload: { error: string; retryAfter?: number } = { error: result.message };
      if (result.status === 429 && result.retryAfter) payload.retryAfter = result.retryAfter;
      res.status(result.status).json(payload);
      return;
    }

    const content: string = result.text;
    const match = content.match(/```json\s*([\s\S]*?)\s*```/) ?? content.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn(`🍽️ meal-plan: no JSON found. content starts: ${content.slice(0, 120)}`);
      res.status(502).json({ error: "Failed to parse meal plan" });
      return;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(match[1] ?? match[0]);
    } catch (e) {
      console.warn(`🍽️ meal-plan: JSON.parse failed: ${(e as Error).message}. snippet: ${(match[1] ?? match[0]).slice(0, 120)}`);
      res.status(502).json({ error: "Invalid meal plan JSON" });
      return;
    }
    const days = parsed.days ?? {};
    console.log(`🍽️ meal-plan: parsed days=${Object.keys(days).length}`);

    // Build DietMeal rows, computing macros deterministically per day.
    const mealRows: any[] = [];
    for (const day of MEAL_DAYS) {
      const meals: any[] = Array.isArray(days[day]) ? days[day].slice(0, 4) : [];
      while (meals.length < 4) meals.push({}); // guard: always 4 slots
      const cals = meals.map((m) => Number(m?.cal) || 0);
      const sum  = cals.reduce((a, b) => a + b, 0);
      meals.forEach((m, i) => {
        const share = sum > 0 ? cals[i] / sum : SLOT_SHARES[i];
        mealRows.push({
          dayOfWeek: day,
          mealName:  m?.name || ["فطور", "غداء", "وجبة خفيفة", "عشاء"][i],
          mealTime:  m?.time || "",
          mealType:  SLOT_TYPES[i],
          calories:  Math.round(share * totalCalories),
          proteinG:  Math.round(share * proteinT),
          carbsG:    Math.round(share * carbsT),
          fatG:      Math.round(share * fatT),
          items:     Array.isArray(m?.items) ? m.items : [],
          emoji:     m?.emoji || null,
        });
      });
    }

    await prisma.dietPlan.updateMany({
      where: { userId, isActive: true },
      data:  { isActive: false },
    });
    const newPlan = await prisma.dietPlan.create({
      data: {
        userId,
        totalCalories,
        proteinGrams: proteinT,
        carbsGrams:   carbsT,
        fatGrams:     fatT,
        isActive:     true,
        meals:        { create: mealRows },
      },
      include: { meals: true },
    });

    console.log(`🍽️ meal-plan: saved ${newPlan.meals.length} meals`);
    res.status(201).json(newPlan);
  } catch (err) {
    console.error("🍽️ generate-meal-plan error:", err);
    res.status(500).json({ error: "Failed to generate meal plan" });
  }
});

export default router;
