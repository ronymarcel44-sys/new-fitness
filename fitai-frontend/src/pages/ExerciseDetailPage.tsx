import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowRight, Play, ChevronLeft, ChevronRight, Loader2, RefreshCw, Bell } from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/app/hooks";
import { toggleDone, toggleDoneThunk, setPlan, completeSet, resetExerciseSets } from "@/features/workout/workoutSlice";import { markActiveTodayThunk } from "@/features/progress/progressSlice";
import { checkDayReset } from "@/features/nutrition/nutritionSlice";
import { DAYS_ORDER, type DayName, type Exercise } from "@/types";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";

const TODAY     = DAYS_ORDER[new Date().getDay()];
const TODAY_IDX = new Date().getDay();

// يستخرج وزن سيت معين من نص مثل "15/20/20 كغ" أو "دمبل 8/10/10 كغ"
function getSetWeight(weightStr: string, setIdx: number): string {
  if (!weightStr || weightStr === "وزن الجسم") return weightStr || "";
  // ابحث عن أرقام مفصولة بـ /
  const nums = weightStr.match(/[\d.]+/g);
  if (!nums || nums.length <= 1) return weightStr; // وزن واحد لكل السيتات
  const unit = weightStr.replace(/[\d./]/g, "").trim(); // "كغ" أو "دمبل كغ"
  const val  = nums[Math.min(setIdx, nums.length - 1)];
  // إذا كانت الوحدة تحتوي "دمبل"
  if (weightStr.toLowerCase().includes("دمبل")) return `دمبل ${val} كغ`;
  return `${val} ${unit}`.trim();
}

// يستخرج تكرارات سيت معين من نص مثل "12/10/8" — لكل سيت رقمه الخاص.
// إذا كان هناك رقم واحد فقط ("10") يُستخدم لكل السيتات (توافق مع الخطط القديمة).
function getSetReps(repsStr: string, setIdx: number): string {
  if (!repsStr) return "";
  const parts = repsStr.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return repsStr; // قيمة واحدة لكل السيتات (أو مدة مثل "20 دقيقة")
  return parts[Math.min(setIdx, parts.length - 1)];
}

// هل التمرين يستخدم أوزان (مش وزن الجسم أو فارغ)
function hasEquipmentWeight(weightStr: string): boolean {
  return !!weightStr && weightStr !== "وزن الجسم" && weightStr !== "";
}
const API_KEY   = import.meta.env.VITE_RAPIDAPI_KEY;

const RAPI_HEADERS = {
  "x-rapidapi-host": "exercisedb.p.rapidapi.com",
  "x-rapidapi-key": API_KEY,
};

interface ExerciseData {
  gifUrl: string;
  bodyPart: string;
  equipment: string;
  target: string;
  secondaryMuscles: string[];
}

interface AiContent {
  description: string;
  steps: string[];
  mistakes: string[];
}

interface SimilarExercise {
  id: string;
  name: string;
  gifUrl: string;
  bodyPart: string;
  equipment: string;
  target: string;
}

export function ExerciseDetailPage() {
  const { dayName, exerciseId } = useParams<{ dayName: string; exerciseId: string }>();
  const navigate  = useNavigate();
  const dispatch  = useAppDispatch();

  const { weeklyPlan } = useAppSelector((s) => s.workout);
  const coachExerciseNotes = useAppSelector((s) => s.user.coachExerciseNotes);

  const day      = dayName as DayName;
  const dayData  = weeklyPlan?.[day];
  const exercise = dayData?.exercises.find((e) => e.id === exerciseId);
  const exercises = dayData?.exercises ?? [];
  const exIndex  = exercises.findIndex((e) => e.id === exerciseId);
  const prevEx   = exIndex > 0 ? exercises[exIndex - 1] : null;
  const nextEx   = exIndex < exercises.length - 1 ? exercises[exIndex + 1] : null;
  const isPastDay = DAYS_ORDER.indexOf(day) < TODAY_IDX;

  // ── Sets Tracker — من Redux ──────────────────────────────────────────
  const totalSets   = parseInt(exercise?.sets ?? "0") || 0;
  const restSeconds = parseInt((exercise?.rest ?? "60").replace(/[^0-9]/g, "")) || 60;

  const { completedSets: allCompleted } = useAppSelector((s) => s.workout);
  const completedSets = allCompleted[exercise?.id ?? ""] ?? [];

  const [restTimer, setRestTimer] = useState<number>(0);
  const [isResting, setIsResting] = useState(false);
  const [activeSet, setActiveSet] = useState(0);

  const [apiData,   setApiData]   = useState<ExerciseData | null>(null);
  const [aiContent, setAiContent] = useState<AiContent | null>(null);
  const [similar,   setSimilar]   = useState<SimilarExercise[]>([]);
  const [loadApi,   setLoadApi]   = useState(true);
  const [loadAi,    setLoadAi]    = useState(true);
  const [loadSim,   setLoadSim]   = useState(false);
  const [imgError,  setImgError]  = useState(false);

  useEffect(() => {
    if (!exercise) return;
    setApiData(null);
    setAiContent(null);
    setSimilar([]);
    setImgError(false);
    setLoadApi(true);
    setLoadAi(true);

    fetchFromApi(exercise.nameEn || exercise.name);
    fetchAiContent(exercise.nameEn || exercise.name, exercise.muscleGroup, exercise.notes);
  }, [exerciseId]);

  // ── reset المؤقت لما يتغير التمرين ─────────────────────────────────
  useEffect(() => {
    if (!exercise) return;
    setRestTimer(0);
    setIsResting(false);
    // activeSet = أول سيت غير مكتمل — بس لا تشغل toggleDone
    const done = allCompleted[exercise.id] ?? [];
    const nextPending = done.length < totalSets ? done.length : totalSets - 1;
    setActiveSet(nextPending);
    dispatch(checkDayReset());
  }, [exerciseId]);

  // ── مؤقت الراحة ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isResting || restTimer <= 0) return;
    const interval = setInterval(() => {
      setRestTimer((t) => {
        if (t <= 1) {
          setIsResting(false);
          clearInterval(interval);
          // صوت تنبيه
          try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA...").play().catch(()=>{}); } catch {}
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isResting, restTimer]);

  // ── إنهاء التمرين تلقائياً لما تكتمل السيتات ────────────────────────
  // hasMounted: يمنع الـ useEffect من الشغل عند أول render
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    if (!exercise || isPastDay) return;
    if (totalSets > 0 && completedSets.length === totalSets && !exercise.done) {
     dispatch(toggleDone({ day, exerciseId: exercise.id }));
      dispatch(toggleDoneThunk({ exerciseId: exercise.id, done: true })); // [added] persist to DB
      dispatch(markActiveTodayThunk());
    }
  }, [completedSets.length]);

  function handleCompleteSet(setIdx: number) {
    if (completedSets.includes(setIdx)) return;
    dispatch(completeSet({ exerciseId: exercise!.id, setIdx }));
    const nextSet = setIdx + 1;
    if (nextSet < totalSets) {
      setActiveSet(nextSet);
      setRestTimer(restSeconds);
      setIsResting(true);
    }
  }

  function handleSkipRest() {
    setIsResting(false);
    setRestTimer(0);
  }

  // ── جلب GIF والمعلومات من ExerciseDB ─────────────────────────────────
  async function fetchFromApi(nameEn: string) {
    const tryFetch = async (url: string) => {
      const res = await fetch(url, { headers: RAPI_HEADERS });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    };

    try {
      const key = nameEn.toLowerCase().trim();
      let ex = await tryFetch(
        `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(key)}?limit=3&offset=0`
      );
      if (!ex) {
        ex = await tryFetch(
          `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(key.split(" ")[0])}?limit=5&offset=0`
        );
      }
      if (ex) {
        setApiData({
          gifUrl:           ex.gifUrl,
          bodyPart:         ex.bodyPart,
          equipment:        ex.equipment,
          target:           ex.target,
          secondaryMuscles: ex.secondaryMuscles ?? [],
        });
        // جلب التمارين الشبيهة بنفس العضلة
        fetchSimilar(ex.target, ex.id);
      }
    } catch { /* تجاهل */ }
    setLoadApi(false);
  }

  // ── جلب تمارين شبيهة ──────────────────────────────────────────────────
  async function fetchSimilar(target: string, currentId: string) {
    setLoadSim(true);
    try {
      const res = await fetch(
        `https://exercisedb.p.rapidapi.com/exercises/target/${encodeURIComponent(target)}?limit=6&offset=0`,
        { headers: RAPI_HEADERS }
      );
      if (res.ok) {
        const data = await res.json();
        const filtered = (data as SimilarExercise[])
          .filter((e) => e.id !== currentId)
          .slice(0, 4);
        setSimilar(filtered);
      }
    } catch { /* تجاهل */ }
    setLoadSim(false);
  }

  // ── جلب الوصف والخطوات والأخطاء من الـ backend (يستدعي Groq) بالعربي ──
  async function fetchAiContent(nameEn: string, muscleGroup: string, _coachNote: string) {
    try {
      const parsed = await apiRequest<AiContent>("POST", "/ai/exercise-info", {
        nameEn,
        muscleGroup,
      });
      if (parsed && parsed.description && parsed.steps) {
        setAiContent(parsed);
      } else {
        console.error("Could not parse AI response");
      }
    } catch (err) {
      console.error("fetchAiContent error:", err);
    }
    setLoadAi(false);
  }

  const youtubeUrl = exercise
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent((exercise.nameEn || exercise.name) + " exercise tutorial correct form")}`
    : "#";

  if (!exercise || !dayData) {
    return (
      <div className="mx-auto max-w-2xl px-6 pt-28 text-center">
        <p className="text-slate-400">التمرين غير موجود</p>
        <Link to="/workout" className="mt-4 inline-block text-accent hover:underline">← العودة</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-28">

      {/* ── شريط التنقل ── */}
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => navigate("/workout")}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <ArrowRight className="h-4 w-4" /> تمارين اليوم
        </button>
        <span className="text-xs text-slate-500">{day} · {dayData.focus}</span>
      </div>

      {/* ── اسم التمرين ── */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-white">{exercise.nameEn || exercise.name}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{exercise.name}</p>
        {exercise.coachEdited && (
          <span className="mt-1 inline-block rounded-full border border-brand-purple/30 bg-brand-purple/10 px-2.5 py-0.5 text-xs font-semibold text-brand-purple">
            ✨ عدّلها مدربك
          </span>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-semibold text-accent">
            {exercise.muscleGroup}
          </span>
          <span className="rounded-full border border-white/10 bg-bg px-3 py-1 text-xs text-slate-400">
            {exercise.sets} سيت × {exercise.reps}
          </span>
          {exercise.rest && (
            <span className="rounded-full border border-white/10 bg-bg px-3 py-1 text-xs text-slate-400">
              ⏱️ راحة {exercise.rest}
            </span>
          )}
          {apiData?.equipment && (
            <span className="rounded-full border border-white/10 bg-bg px-3 py-1 text-xs text-slate-400 capitalize">
              🏋️ {apiData.equipment}
            </span>
          )}
        </div>
      </div>

      {/* ── GIF التمرين ── */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-bg-card">
        {loadApi ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : apiData?.gifUrl && !imgError ? (
          <img src={apiData.gifUrl} alt={exercise.nameEn}
            onError={() => setImgError(true)}
            className="mx-auto h-72 w-full object-contain" />
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
            <span className="text-5xl">🏋️</span>
            <p className="text-sm">شاهد التمرين على يوتيوب</p>
          </div>
        )}
      </div>

      {/* ── زر يوتيوب ── */}
      <a href={youtubeUrl} target="_blank" rel="noopener noreferrer"
        className="mb-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 py-4 text-sm font-bold text-red-400 transition-all hover:bg-red-500/20">
        <Play className="h-5 w-5 fill-red-400" />
        شاهد على YouTube — {exercise.nameEn} tutorial
      </a>

      {/* ── وصف التمرين (AI) ── */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-bg-card p-5">
        <h3 className="mb-3 font-bold">📋 ما هو هذا التمرين؟</h3>
        {loadAi ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> جاري التحليل...
          </div>
        ) : aiContent?.description ? (
          <p className="text-sm leading-relaxed text-slate-300">{aiContent.description}</p>
        ) : (
          <p className="text-sm text-slate-500">لم يتوفر وصف</p>
        )}

        {/* العضلات الثانوية */}
        {apiData?.secondaryMuscles && apiData.secondaryMuscles.length > 0 && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <p className="mb-2 text-xs font-semibold text-slate-500">العضلات المساعدة</p>
            <div className="flex flex-wrap gap-2">
              {apiData.secondaryMuscles.map((m) => (
                <span key={m} className="rounded-full border border-white/10 bg-bg px-2.5 py-0.5 text-xs text-slate-400 capitalize">{m}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── خطوات التنفيذ (AI بالعربي) ── */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-bg-card p-5">
        <h3 className="mb-4 font-bold">✅ خطوات التنفيذ الصحيح</h3>
        {loadAi ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل...
          </div>
        ) : aiContent?.steps && aiContent.steps.length > 0 ? (
          <ol className="space-y-3">
            {aiContent.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-slate-300">{step}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">لم تتوفر خطوات</p>
        )}
      </div>

      {/* ── الأخطاء الشائعة (AI) ── */}
      <div className="mb-4 rounded-2xl border border-red-500/15 bg-red-500/5 p-5">
        <h3 className="mb-4 font-bold text-red-400">⚠️ أخطاء شائعة تجنّبها</h3>
        {loadAi ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل...
          </div>
        ) : aiContent?.mistakes && aiContent.mistakes.length > 0 ? (
          <ul className="space-y-3">
            {aiContent.mistakes.map((mistake, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 text-red-400">✗</span>
                <p className="text-sm leading-relaxed text-slate-300">{mistake}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">لم تتوفر معلومات</p>
        )}
      </div>

      {/* ── نصيحة من الـ AI ── */}
      {exercise.notes && (
        <div className="mb-4 rounded-2xl border border-accent/20 bg-accent/5 p-5">
          <h3 className="mb-2 text-sm font-bold text-accent">💡 نصيحة</h3>
          <p className="text-sm leading-relaxed text-slate-300">{exercise.notes}</p>
        </div>
      )}

      {/* ── ملاحظة من المدرب البشري ── */}
      {coachExerciseNotes[exercise.id] && (
        <div className="mb-4 rounded-2xl border border-brand-purple/25 bg-brand-purple/5 p-5">
          <h3 className="mb-2 text-sm font-bold text-brand-purple">👨‍🏫 ملاحظة من مدربك</h3>
          <p className="text-sm leading-relaxed text-slate-300">{coachExerciseNotes[exercise.id]}</p>
        </div>
      )}

      {/* ── Sets Tracker ── */}
      {!isPastDay && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-bg-card">

          {/* رأس البطاقة */}
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <div>
              <p className="font-bold">تتبع السيتات</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {completedSets.length} / {totalSets} سيت مكتمل
              </p>
            </div>
            {exercise.done && (
              <span className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                ✓ منجز
              </span>
            )}
          </div>

          {/* مؤقت الراحة */}
          {isResting && (
            <div className="border-b border-white/5 bg-brand-blue/5 px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-brand-blue">
                  <Bell className="h-4 w-4" />
                  <span className="text-sm font-bold">وقت الراحة</span>
                </div>
                <button onClick={handleSkipRest}
                  className="text-xs text-slate-500 hover:text-white transition-colors">
                  تخطي ←
                </button>
              </div>
              {/* شريط المؤقت */}
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-brand-blue transition-all duration-1000"
                  style={{ width: `${(restTimer / restSeconds) * 100}%` }} />
              </div>
              <p className="text-center text-2xl font-black text-brand-blue">
                {Math.floor(restTimer / 60)}:{String(restTimer % 60).padStart(2, "0")}
              </p>
            </div>
          )}

          {/* الأوزان المقترحة من الكوتش — تعرض وزن كل سيت */}
          {exercise.weight && hasEquipmentWeight(exercise.weight) && (
            <div className="mx-4 mb-3 rounded-xl border border-brand-orange/20 bg-brand-orange/5 px-4 py-3">
              <p className="mb-2 text-xs text-slate-500">🏋️ الأوزان المقترحة من الكوتش</p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: totalSets }).map((_, i) => (
                  <div key={i} className={cn(
                    "flex flex-col items-center rounded-lg border px-3 py-1.5",
                    completedSets.includes(i)
                      ? "border-accent/20 bg-accent/5"
                      : i === activeSet
                      ? "border-brand-orange/40 bg-brand-orange/10"
                      : "border-white/10 bg-bg"
                  )}>
                    <span className="text-[10px] text-slate-500">سيت {i + 1}</span>
                    <span className={cn(
                      "text-sm font-black",
                      completedSets.includes(i) ? "text-accent" : i === activeSet ? "text-brand-orange" : "text-slate-400"
                    )}>
                      {getSetWeight(exercise.weight, i)}
                    </span>
                    <span className="text-[10px] text-slate-600">{getSetReps(exercise.reps, i)} تكرار</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* السيتات */}
          <div className="space-y-2 p-4">
            {Array.from({ length: totalSets }).map((_, i) => {
              const isDone   = completedSets.includes(i);
              const isActive = i === activeSet && !isDone;
              const isLocked = i > activeSet && !isDone;

              return (
                <div key={i}
                  className={cn(
                    "overflow-hidden rounded-xl border transition-all",
                    isDone    ? "border-accent/20 bg-accent/5"
                    : isActive ? "border-accent/40 bg-accent/10"
                    : "border-white/5 bg-bg opacity-50"
                  )}>

                  {/* صف رئيسي */}
                  <div className="flex items-center gap-3 p-3">
                    {/* رقم السيت */}
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                      isDone ? "bg-accent/20 text-accent" : isActive ? "bg-accent/10 text-accent" : "bg-white/5 text-slate-500"
                    )}>
                      {isDone ? "✓" : i + 1}
                    </div>

                    {/* معلومات السيت */}
                    <div className="flex-1">
                      <p className={cn("text-sm font-semibold", isDone ? "text-accent" : isActive ? "text-white" : "text-slate-500")}>
                        السيت {i + 1}
                      </p>
                      <p className="text-xs text-slate-600">
                        {getSetReps(exercise.reps, i)} تكرار
                        {exercise.weight && hasEquipmentWeight(exercise.weight) && (
                          <span className="mr-1 text-brand-orange">· {getSetWeight(exercise.weight, i)}</span>
                        )}
                      </p>
                    </div>

                    {/* زر إنجاز / حالة */}
                    {isDone && (
                      <div className="text-right">
                        <p className="text-xs text-slate-600">مكتمل ✓</p>
                      </div>
                    )}
                    {isActive && isResting && (
                      <span className="rounded-xl border border-brand-blue/30 bg-brand-blue/10 px-3 py-2 text-xs font-semibold text-brand-blue">
                        استرح...
                      </span>
                    )}
                    {isActive && !isResting && (
                      <button onClick={() => handleCompleteSet(i)}
                        className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-bg transition-all hover:bg-accent/90 active:scale-95">
                        ✓ تم
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>

          {/* إنجاز يدوي للتمرين كاملاً */}
          {!exercise.done && completedSets.length < totalSets && (
            <div className="border-t border-white/5 px-4 pb-4">
                <button onClick={() => {
                dispatch(toggleDone({ day, exerciseId: exercise.id }));
                dispatch(toggleDoneThunk({ exerciseId: exercise.id, done: true })); // [added] persist to DB
              }}
                className="mt-3 w-full rounded-xl border border-white/10 py-2.5 text-xs text-slate-500 transition-all hover:border-white/20 hover:text-slate-300">
                تخطي هذا التمرين
              </button>
            </div>
          )}

          {/* اكتملت كل السيتات */}
          {exercise.done && (
            <div className="border-t border-white/5 px-5 py-4 text-center">
              <p className="text-sm font-bold text-accent">🎉 أحسنت! أكملت كل السيتات</p>
              <button onClick={() => {
                  dispatch(resetExerciseSets(exercise.id));
                  setActiveSet(0);
                  setRestTimer(0);
                  setIsResting(false);
                }}
                className="mt-2 text-xs text-slate-600 hover:text-slate-400 transition-colors">
                إعادة التمرين
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── تمارين شبيهة ── */}
      <div className="mb-6">
        <h3 className="mb-4 font-bold">
          🔄 تمارين بديلة لنفس العضلة
          {apiData?.target && (
            <span className="mr-2 text-xs font-normal text-slate-500 capitalize">({apiData.target})</span>
          )}
        </h3>

        {loadSim ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> جاري البحث...
          </div>
        ) : similar.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {similar.map((sim) => (
              <div key={sim.id}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-bg-card transition-all hover:border-accent/30"
                onClick={() => {
                  if (!weeklyPlan) return;

                  // احسب وزن مناسب للتمرين البديل بناءً على نفس نسبة التمرين الأصلي
                  // مثال: الأصلي "15/20/20 كغ" → البديل يورث نفس الهيكل
                  const inheritedWeight = exercise.weight || "";

                  const newExercise: Exercise = {
                    id:          `sim_${sim.id}`,
                    name:        sim.name,
                    nameEn:      sim.name,
                    sets:        exercise.sets,
                    reps:        exercise.reps,
                    rest:        exercise.rest,
                    weight:      inheritedWeight,
                    notes:       `بديل عن: ${exercise.nameEn || exercise.name}`,
                    muscleGroup: exercise.muscleGroup,
                    done:        false,
                  };

                  const updatedPlan = JSON.parse(JSON.stringify(weeklyPlan));
                  const idx = updatedPlan[day].exercises.findIndex((e: Exercise) => e.id === exerciseId);
                  if (idx !== -1) updatedPlan[day].exercises[idx] = newExercise;
                  dispatch(setPlan({ exercises: [], weeklyPlan: updatedPlan }));
                  navigate(`/exercise/${encodeURIComponent(day)}/${newExercise.id}`);
                }}>
                <div className="relative h-28 overflow-hidden bg-bg">
                  <img src={sim.gifUrl} alt={sim.name}
                    className="h-full w-full object-contain transition-transform group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-card to-transparent h-8" />
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-white capitalize leading-tight line-clamp-2">{sim.name}</p>
                  <p className="mt-1 text-[10px] text-slate-500 capitalize">{sim.equipment}</p>
                </div>
                <div className="px-2.5 pb-2.5">
                  <span className="flex items-center justify-center gap-1 rounded-lg border border-accent/20 py-1 text-[10px] font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100">
                    <RefreshCw className="h-2.5 w-2.5" /> استبدل
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : !loadApi ? (
          <p className="text-sm text-slate-500">لم تتوفر تمارين بديلة</p>
        ) : null}
      </div>

      {/* ── التنقل بين التمارين ── */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => prevEx && navigate(`/exercise/${encodeURIComponent(day)}/${prevEx.id}`)}
          disabled={!prevEx}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-xs font-semibold transition-all",
            prevEx ? "border-white/10 bg-bg-card text-slate-300 hover:border-white/20" : "border-white/5 bg-bg-card/30 text-slate-700 cursor-not-allowed"
          )}>
          <ChevronRight className="h-4 w-4" />
          {prevEx ? (prevEx.nameEn || prevEx.name) : "السابق"}
        </button>

        <span className="shrink-0 text-xs text-slate-600">{exIndex + 1}/{exercises.length}</span>

        <button
          onClick={() => nextEx && navigate(`/exercise/${encodeURIComponent(day)}/${nextEx.id}`)}
          disabled={!nextEx}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-xs font-semibold transition-all",
            nextEx ? "border-white/10 bg-bg-card text-slate-300 hover:border-white/20" : "border-white/5 bg-bg-card/30 text-slate-700 cursor-not-allowed"
          )}>
          {nextEx ? (nextEx.nameEn || nextEx.name) : "التالي"}
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}