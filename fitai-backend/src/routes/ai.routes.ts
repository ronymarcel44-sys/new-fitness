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

// The plan-building instructions: calculation tables + JSON schema only. Sent
// ONLY on the plan-build turn (planMode). Trimmed of all interview/conversation
// content (goal sub-flow, measurements wording, one-question rules) — those live
// in INTERVIEW_PROMPT — so the build request stays small enough to fit a complete
// plan within Groq's per-request token ceiling. The user's answers come from the
// chat history, not from this prompt.
const PLAN_BUILDER_PROMPT = `أنت مساعد لياقة بدنية ذكي باللغة العربية اسمك FitAI. جمعت بيانات المستخدم من المحادثة، وعليك الآن إنشاء خطته.

### قواعد صارمة:
1. اكتب بالعربية الفصيحة السليمة فقط داخل كل النصوص المقروءة (name, notes, أسماء الأطعمة...). ممنوع خلط أي كلمة إنجليزية أو حرف لاتيني داخل جملة عربية. الاستثناء الوحيد: حقل "nameEn" (اسم التمرين بالإنجليزية) وقيمة "goal" (المفتاح الإنجليزي) — هذان فقط، ولا يظهران كنص محادثة.
2. ممنوع إرسال JSON إذا كان أي حقل أساسي فارغاً أو صفراً.
3. كل قيمة في JSON يجب أن تكون حقيقية ومحسوبة بناءً على بيانات المستخدم الفعلية.
4. عدد التمارين يجب أن يتناسب مع المستوى (مبتدئ: 3-4 لكل يوم، متوسط: 4-5، متقدم: 5-6).
5. المستخدم أكّد هدفاً نهائياً واحداً محدداً بالأرقام أثناء المحادثة السابقة (راجع الرسائل) — استخدم بالضبط الرقم/الأرقام المتفق عليها في حقل "confirmedGoal" أدناه، لا تعد حسابها من الصفر ولا تخترع رقماً مختلفاً عنها.
6. ⚠️ حقل "confirmedGoal" إلزامي في كل استجابة JSON بدون استثناء. النظام يعتمد عليه بالكامل لحفظ هدف المستخدم في قاعدة البيانات؛ نسيانه أو حذفه يعني ضياع الهدف الذي اتفقتما عليه بالكامل. راجعه قبل إرسال أي JSON وتأكد من وجوده.

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

**⚠️ أوزان الرفعات الأساسية — استخدم أرقام المستخدم الحقيقية (أولوية قصوى):**
إذا ذكر المستخدم في المحادثة أوزانه الحالية في الرفعات الأساسية (بنش برس، سكوات، رفعة ميتة، بريس علوي)، فاجعل أوزان سيتات هذه التمارين تتدرّج تصاعدياً حتى تصل لرقمه الحالي في السيت الأخير — **ولا تتجاوزه إطلاقاً في الخطة الأولى**. المطلوب أن يكون كل وزن قابلاً للرفع فعلاً من اليوم الأول (التقدّم يأتي لاحقاً). مثال: مستخدم بنشه الحالي 60كغ في 4 سيتات → "weight":"45/50/55/60 كغ". أما التمارين التي لم يذكر لها رقماً (تمارين مساعدة أو عزل) فاستخدم الجدول التقديري أدناه.

**الأوزان المبدئية حسب المستوى ووزن الجسم (للتمارين التي لا يوجد لها رقم من المستخدم):**

مبتدئ: الصدر بالبار 20-30%، الظهر 25-35%، الأرجل 30-40%، دمبل كتف 5-8كغ، دمبل بايسبس 6-10كغ
متوسط: الصدر بالبار 40-60%، الظهر 50-70%، سكوات 60-80%، دمبل كتف 10-15كغ، دمبل بايسبس 12-16كغ
متقدم: الصدر بالبار 70-100%، الظهر 80-120%، سكوات 100-150%، دمبل كتف 18-25كغ، دمبل بايسبس 18-25كغ

**كل سيت مختلف (مثل مدرب محترف) — مهم جداً:**
- تمارين الأوزان: وزن تصاعدي مختلف لكل سيت (من الأخف للأثقل) مع تكرارات تنازلية كلما زاد الوزن. افصل القيم بـ "/" وليكن عددها مساوياً لعدد السيتات بالضبط.
  مثال (4 سيتات): "sets":"4"، "weight":"20/25/30/30 كغ"، "reps":"12/10/8/8"
- تمارين وزن الجسم: "weight":"وزن الجسم"، والتكرارات تتغير لكل سيت (تنازلية بسبب التعب) مفصولة بـ "/" بعدد السيتات. مثال (3 سيتات): "reps":"15/12/10". وللتمارين الزمنية مثل البلانك استخدم الثواني تنازلياً: "reps":"45/40/35 ثانية".
- كارديو وإطالة: "weight":"" والتكرارات قيمة واحدة (مدة) مثل "20 دقيقة" — بدون "/".

### تمييز الكارديو عن القوة (exerciseType) — إلزامي لكل تمرين:
كل تمرين في الـ JSON يحتاج حقل "exerciseType": "strength" أو "cardio":
- تمارين القوة (أوزان أو وزن الجسم): "exerciseType":"strength"، "durationMinutes":null، واستخدم sets/reps/weight بالتنسيق أعلاه.
- تمارين الكارديو: "exerciseType":"cardio"، "durationMinutes": رقم صحيح بالدقائق (مثال 20، بدون نص)، واترك "sets":"" و"reps":"" و"weight":"".

### مفتاح الهدف:
المستخدم اختار هدفه أثناء المحادثة. خزّن المفتاح الإنجليزي المقابل في حقل \`goal\` (واحد بالضبط من): \`fat_loss\` | \`muscle_gain\` | \`bodybuilding\` | \`body_recomposition\` | \`strength\`

### القياسات والجنس في الـ JSON:
- الجنس: ضع "male" أو "female" بناءً على إجابة المستخدم الفعلية في المحادثة — إلزامي، لا تتركه فارغاً أبداً.
- القياسات (بما فيها الرقبة neck): ضع كل قيمة في حقلها (chest, waist, hips, arms, legs, neck) — أرقام فقط بدون وحدة ولا أي نص إضافي. هذه إلزامية أيضاً (راجع قسم "تأكيد الهدف" — لا يُفترض أن تصل لهذه المرحلة أصلاً بدون قياسات فعلية).
  صحيح: "chest": "95"  —  خطأ ممنوع: "chest": "95 سم" أو "chest": "95cm" أو "chest": "حوالي 95". نفس القاعدة على "weight" و"height" و"age" — رقم فقط، بدون أي وحدة أو كلمة.

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
    "الاثنين": { "type": "تمرين", "focus": "ظهر", "exercises": [
      { "id": "d2e1", "name": "سحب أرضي", "nameEn": "Seated Cable Row", "exerciseType": "strength", "durationMinutes": null, "sets": "4", "reps": "12/10/8/8", "rest": "90 ثانية", "weight": "30/35/40/40 كغ", "notes": "...", "muscleGroup": "ظهر", "done": false },
      { "id": "d2e2", "name": "سحب علوي", "nameEn": "Lat Pulldown", "exerciseType": "strength", "durationMinutes": null, "sets": "3", "reps": "12/10/10", "rest": "60 ثانية", "weight": "35/40/45 كغ", "notes": "...", "muscleGroup": "ظهر", "done": false }
    ]},
    "الثلاثاء": { "type": "راحة", "focus": "أرجل", "exercises": [
      { "id": "d3e1", "name": "سكوات", "nameEn": "Barbell Squat", "exerciseType": "strength", "durationMinutes": null, "sets": "4", "reps": "12/10/8/8", "rest": "120 ثانية", "weight": "40/50/60/60 كغ", "notes": "...", "muscleGroup": "أرجل", "done": false },
      { "id": "d3e2", "name": "دفع الأرجل", "nameEn": "Leg Press", "exerciseType": "strength", "durationMinutes": null, "sets": "3", "reps": "12/10/10", "rest": "90 ثانية", "weight": "80/90/100 كغ", "notes": "...", "muscleGroup": "أرجل", "done": false }
    ]},
    "الأربعاء": { "type": "تمرين", "focus": "كتف", "exercises": [
      { "id": "d4e1", "name": "ضغط كتف", "nameEn": "Shoulder Press", "exerciseType": "strength", "durationMinutes": null, "sets": "4", "reps": "12/10/8/8", "rest": "90 ثانية", "weight": "20/25/30/30 كغ", "notes": "...", "muscleGroup": "كتف", "done": false },
      { "id": "d4e2", "name": "رفرفة جانبية", "nameEn": "Lateral Raise", "exerciseType": "strength", "durationMinutes": null, "sets": "3", "reps": "15/12/12", "rest": "60 ثانية", "weight": "دمبل 6/8/8 كغ", "notes": "...", "muscleGroup": "كتف", "done": false }
    ]},
    "الخميس": { "type": "تمرين", "focus": "ذراعين", "exercises": [
      { "id": "d5e1", "name": "مرجحة بايسبس", "nameEn": "Bicep Curl", "exerciseType": "strength", "durationMinutes": null, "sets": "3", "reps": "12/10/10", "rest": "60 ثانية", "weight": "دمبل 10/12/14 كغ", "notes": "...", "muscleGroup": "ذراعين", "done": false },
      { "id": "d5e2", "name": "ترايسبس بالحبل", "nameEn": "Triceps Pushdown", "exerciseType": "strength", "durationMinutes": null, "sets": "3", "reps": "12/10/10", "rest": "60 ثانية", "weight": "20/25/30 كغ", "notes": "...", "muscleGroup": "ذراعين", "done": false }
    ]},
    "الجمعة": { "type": "راحة", "focus": "بطن وكارديو", "exercises": [
      { "id": "d6e1", "name": "بلانك", "nameEn": "Plank", "exerciseType": "strength", "durationMinutes": null, "sets": "3", "reps": "45/40/35 ثانية", "rest": "45 ثانية", "weight": "وزن الجسم", "notes": "...", "muscleGroup": "بطن", "done": false },
      { "id": "d6e2", "name": "كارديو", "nameEn": "Treadmill Running", "exerciseType": "cardio", "durationMinutes": 20, "sets": "", "reps": "", "rest": "-", "weight": "", "notes": "...", "muscleGroup": "كارديو", "done": false }
    ]},
    "السبت": { "type": "تمرين", "focus": "جسم كامل", "exercises": [
      { "id": "d7e1", "name": "رفعة ميتة", "nameEn": "Deadlift", "exerciseType": "strength", "durationMinutes": null, "sets": "4", "reps": "8/6/5/5", "rest": "120 ثانية", "weight": "50/60/70/70 كغ", "notes": "...", "muscleGroup": "ظهر وأرجل", "done": false },
      { "id": "d7e2", "name": "ضغط بوش أب", "nameEn": "Push Up", "exerciseType": "strength", "durationMinutes": null, "sets": "3", "reps": "15/12/10", "rest": "60 ثانية", "weight": "وزن الجسم", "notes": "...", "muscleGroup": "صدر", "done": false }
    ]}
  },
  "nutrition": { "totalCalories": 2200, "protein": 165, "carbs": 220, "fat": 73 },
  "confirmedGoal": { "mainTargetWeight": null, "mainTargetBodyFatPct": null, "mainTargetBenchPress": null, "mainTargetSquat": null, "mainTargetDeadlift": null, "mainTargetOverheadPress": null, "startBench": null, "startSquat": null, "startDeadlift": null, "startOverheadPress": null }
}
\`\`\`

### الهدف المؤكَّد في الـ JSON (confirmedGoal):
حقل confirmedGoal يحوي **مجموعتين منفصلتين تماماً** — عبِّئ كلتيهما، لا واحدة فقط:

**المجموعة (أ) — رقم الهدف على المدى الطويل:** عبِّئ فقط حقل/حقول *الهدف* المرتبطة بهدف المستخدم بالرقم الذي اتفقتما عليه، واترك باقي حقول *الهدف* null. رقم واحد نهائي فقط لكل مقياس — لا يوجد "هدف قريب" منفصل بعد الآن. (كلمة "فقط" هنا تخص حقول الهدف في هذه المجموعة، ولا علاقة لها بالمجموعة (ب) أدناه.)
- fat_loss: mainTargetWeight + mainTargetBodyFatPct (كلاهما — هذا الهدف الوحيد الذي يحتاج رقمين)
- muscle_gain: mainTargetWeight (كتلة العضلة المستهدفة تُحسب تلقائياً بالسيرفر من هذا الرقم — لا تحاول حسابها أو وضعها بنفسك)
- bodybuilding: mainTargetWeight — نفس حقل muscle_gain بالضبط، لكن برقم أكبر وأكثر طموحاً (فائض غذائي أوضح)
- body_recomposition: mainTargetBodyFatPct فقط. ⚠️ اترك mainTargetWeight = null دائماً لهذا الهدف — كتلة العضلة والوزن النهائي يُحسبان تلقائياً بالسيرفر من نسبة الدهون، لا تضعهما بنفسك
- strength: mainTargetBenchPress + mainTargetSquat + mainTargetDeadlift + mainTargetOverheadPress (الأربعة معاً)

**المجموعة (ب) — ⚠️ أوزان الرفعات الحالية (startBench, startSquat, startDeadlift, startOverheadPress):** هذه ليست جزءاً من الهدف، بل هي نقطة البداية التي ذكرها المستخدم. لأهداف strength / muscle_gain / bodybuilding **يجب** أن تنسخ هنا الأرقام التي قالها المستخدم فعلاً لوزنه الحالي في كل تمرين عندما سألته عن أوزانه الحالية (بنش، سكوات، رفعة ميتة، بريس علوي). إلزامية إذا ذكرها المستخدم — لا تتركها null بحجة أن الهدف يحتاج حقلاً واحداً فقط، فقاعدة "فقط" في المجموعة (أ) لا تنطبق هنا إطلاقاً. اترك null فقط لتمرين لم يذكره المستخدم، و null دائماً لأهداف fat_loss / body_recomposition. لا تخترع رقماً — فقط ما قاله المستخدم فعلاً.

⚠️ لا تضع أي رقم في targetLeanMass أو أي حقل غير مذكور أعلاه — هذه الحقول محذوفة من هذا النظام، والحقول المحسوبة تلقائياً (كتلة العضلة، الوزن النهائي لـ body_recomposition) يحسبها السيرفر بنفسه ولا دخل لك بها.

### مهم:
- IDs فريدة لكل تمرين (d1e1, d1e2...)
- nameEn إنجليزي صحيح لكل تمرين (فقط هذا الحقل بالإنجليزية — كل شيء آخر عربي)
- 5 أيام تمرين + يومان راحة. يوم الجمعة دائماً راحة، واختر يوماً آخر للراحة غير ملاصق للجمعة (لا يكون اليومان متتاليين). أيام التمرين الخمسة يجب أن تغطي كل المجموعات العضلية الرئيسية بشكل متوازن.
- ⚠️ مهم جداً: كل الأيام السبعة (بما فيها يوما الراحة) يجب أن تحتوي على تمرين كامل حقيقي (2-3 تمارين) داخل مصفوفة "exercises" — ممنوع ترك أي يوم فارغاً ([]). الفرق الوحيد ليومَي الراحة هو "type": "راحة" مع احتفاظهما بتمارين كاملة (لأن المستخدم قد يحوّلهما لتمرين). باقي الأيام الخمسة "type": "تمرين".
- القياسات اتركها "" إذا لم يعطها المستخدم
- الأرقام في المثال أعلاه للتوضيح فقط — احسب القيم الحقيقية بناءً على بيانات المستخدم (وزنه، هدفه، مستواه)
- ⚠️ كل تمارين الأوزان: حقلا "weight" و"reps" قيم مفصولة بـ "/" بعدد السيتات (الوزن تصاعدي، التكرار تنازلي). تمارين وزن الجسم: "reps" مفصولة بـ "/" أيضاً. الكارديو/الإطالة فقط: durationMinutes رقم، وsets/reps/weight فارغة "".
- ⚠️ كل تمرين يحتاج "exerciseType": "strength" أو "cardio" (راجع القسم أعلاه) — بدون هذا الحقل لن يُحفظ التمرين بشكل صحيح.
- الخطة الغذائية يجب أن تحتوي دائماً على 3-4 وجبات تغطي اليوم كاملاً (إفطار، غداء، وجبة خفيفة، عشاء)
- التغذية: احسب أهداف اليوم فقط (totalCalories, protein, carbs, fat) — الوجبات تُنشأ في خطوة منفصلة، لا تضع مصفوفة meals

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
2. راجع قسم اللغة أعلاه — عربية فقط دائماً.
3. لا تنتقل للسؤال التالي إلا بعد الحصول على إجابة واضحة.
4. ممنوع إرسال أي خطة أو JSON قبل أن تجمع كل المعلومات وتؤكد الهدف الرقمي معه (راجع قسم "تأكيد الهدف" في آخر هذا البرومبت).

### الترتيب الإلزامي لجمع المعلومات:
1. الاسم  2. العمر  3. الوزن  4. الطول  5. الهدف  6. المستوى  7. الأمراض  8. الجنس  9. قياسات الجسم

اسأل عن كل خطوة بالترتيب.

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
4. **زيادة القوة** — رفع أوزان أثقل والتركيز على القوة
5. **تضخيم عضلي (Bodybuilding)** — زيادة الوزن والعضل معاً بفائض غذائي واضح، لمن يريد حجماً أكبر لا مجرد بناء عضل بوزن ثابت"

إذا كانت إجابة المستخدم تدل بوضوح على زيادة الوزن والحجم معاً (مثل: "أبي أضخم"، "أبي أزيد وزني وعضلي"، "bulking")، فرّق بينه وبين بناء العضلات العادي: بناء العضلات لا يستهدف بالضرورة زيادة وزن كبيرة، بينما تضخيم عضلي هدفه زيادة الوزن والعضل معاً بوضوح.

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

بمجرد التأكيد النهائي، أرسل هذه الجملة **حرفياً وبدون أي تغيير في صياغتها**، كآخر شيء في نفس الرد:

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
  if (isOnboarding && goalConfirmationDone(messages)) return true; // UPDATED (Task 4)
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

  // The plan-build turn needs a big output budget (the full 7-day plan + meals
  // truncated at 2000). But Groq's free tier has a per-request ceiling (~8k):
  // prompt_tokens + max_tokens must fit. The slimmed PLAN_BUILDER_PROMPT keeps the
  // build input small enough that 3000 output fits under that ceiling. Question
  // turns stay tiny.
  const planMode  = needsFullTokens(messages, isOnboarding);
  const maxTokens = planMode ? 3000 : 700;

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
      const err: any = await response.json().catch(() => ({} as any));
      const h = response.headers;
      // Log the FULL Groq error + rate-limit headers so we can see EXACTLY which
      // limit was hit (per-minute vs per-day, tokens vs requests) and when it
      // resets. The error message itself usually spells out "Limit/Used/Requested".
      console.error(
        `❌ Groq ${response.status} [planMode=${planMode}]: ${err?.error?.message ?? "(no message body)"}\n` +
        `   tokens : limit=${h.get("x-ratelimit-limit-tokens")} remaining=${h.get("x-ratelimit-remaining-tokens")} reset=${h.get("x-ratelimit-reset-tokens")}\n` +
        `   requests: limit=${h.get("x-ratelimit-limit-requests")} remaining=${h.get("x-ratelimit-remaining-requests")} reset=${h.get("x-ratelimit-reset-requests")}\n` +
        `   retry-after=${h.get("retry-after")}`
      );
      const payload: { error: string; retryAfter?: number } = {
        error: err?.error?.message ?? "Groq request failed",
      };
      // On a rate-limit (429), tell the client how long to wait. Groq sends a
      // `Retry-After` header (seconds); fall back to 8s when it's missing.
      if (response.status === 429) {
        const ra = Number(h.get("retry-after"));
        payload.retryAfter = Number.isFinite(ra) && ra > 0 ? ra : 8;
      }
      res.status(response.status).json(payload);
      return;
    }

    const data = await response.json() as any;
    const reply = data.choices?.[0]?.message?.content ?? "لم أتمكن من الرد.";

    // Log token usage for monitoring (planMode + the budget we asked for, so we
    // can correlate big turns with rate-limit hits and per-minute accumulation)
    if (data.usage) {
      console.log(`🤖 Groq [planMode=${planMode}, max=${maxTokens}]: ${data.usage.prompt_tokens} in + ${data.usage.completion_tokens} out = ${data.usage.total_tokens} total`);
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
      const err: any = await response.json().catch(() => ({} as any));
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
      const err: any = await response.json().catch(() => ({} as any));
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
      const err: any = await response.json().catch(() => ({} as any));
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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "GROQ_API_KEY not configured on server" }); return; }

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

  const doGroqCall = () => fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "User-Agent":    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens:  3000,
    }),
  });

  try {
    let response = await doGroqCall();

    // This call fires right after the big main-plan call, which usually eats most
    // of the per-minute TPM budget — so a first 429 here is expected. Wait the
    // advised time (the minute window resets) and retry once.
    if (response.status === 429) {
      const ra = Number(response.headers.get("retry-after"));
      const waitSec = Math.min(Number.isFinite(ra) && ra > 0 ? ra + 1 : 16, 30);
      console.log(`🍽️ meal-plan: 429 — waiting ${waitSec}s for the TPM window to reset, then retrying`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      response = await doGroqCall();
    }

    console.log(`🍽️ meal-plan: groq status=${response.status}`);
    if (!response.ok) {
      const err: any = await response.json().catch(() => ({} as any));
      console.warn(`🍽️ meal-plan groq error ${response.status}: ${err?.error?.message ?? "(no body)"}`);
      const payload: { error: string; retryAfter?: number } = { error: err?.error?.message ?? "Groq request failed" };
      if (response.status === 429) {
        const ra = Number(response.headers.get("retry-after"));
        payload.retryAfter = Number.isFinite(ra) && ra > 0 ? ra : 8;
      }
      res.status(response.status).json(payload);
      return;
    }

    const data: any = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
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
