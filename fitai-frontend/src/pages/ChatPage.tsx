// src/pages/ChatPage.tsx
//
// Changes from Step 6:
// - saveMessageThunk: every user and AI message persists to DB
// - saveNutritionThunk: AI nutrition plan persists to DB
// - clearChatThunk: clearing chat also clears DB
// - addWeightEntryThunk: weight entries persist to DB

import { useEffect, useRef, useState } from "react";
import { Send, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { addMessage, setLoading, setSetupComplete, clearChat, saveMessageThunk, clearChatThunk } from "@/features/chat/chatSlice";
import { setProfile, completeSetup, saveProfileThunk } from "@/features/user/userSlice";
import { setPlan as setWorkoutPlan, resetPlan as resetWorkout, saveWorkoutThunk } from "@/features/workout/workoutSlice";
import { setPlan as setNutritionPlan, resetPlan as resetNutrition, generateMealPlanThunk } from "@/features/nutrition/nutritionSlice";
import { addWeightEntry, addWeightEntryThunk } from "@/features/progress/progressSlice";
import { askGemini, parsePlanFromText } from "@/lib/gemini";

const WELCOME_MSG = `مرحباً! أنا مساعدك الرياضي الذكي 🤖\n\nسأساعدك في بناء خطة تمارين وتغذية مخصصة تماماً لجسمك وأهدافك.\n\nللبدء، **ما اسمك؟** 😊`;

// Shown transiently in the typing bubble while we wait out a rate-limit and retry
const BUSY_MSG = "لحظة من فضلك… الخدمة مزدحمة قليلاً وسأكمل بعد ثوانٍ ⏳";
// Shown instead of BUSY_MSG when the wait is long (the plan-build turn can need up
// to a full minute for the free-tier per-minute token budget to reset).
const BUILD_MSG = "خطتك قيد الإنشاء 💪 أمهلني لحظات وستظهر خطتك الكاملة... لا تُغلق الصفحة.";
// Shown as an AI message when the request fails (or the retry also fails)
const FAIL_MSG = "⚠️ لم أتمكن من الرد الآن، حاول مرة أخرى بعد قليل";

export function ChatPage() {
  const dispatch = useAppDispatch();
  const { messages, isLoading, setupComplete, fetched } = useAppSelector((s) => s.chat);

  const [input,       setInput]       = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const initialized  = useRef(false);
  const autoSendRef  = useRef(false);
  const autoBuildRef = useRef(false);

  // The AI ends onboarding with a confirmation line ("...هذا هدفك النهائي...") and
  // is forbidden to include the plan JSON in that same message — the plan is built
  // on the FOLLOWING turn (the server switches to plan-build mode once it sees that
  // line in the history). Marker must match GOAL_CONFIRMATION_MARKER in ai.routes.ts.
  const GOAL_CONFIRMATION_MARKER = "هذا هدفك النهائي";

  // Keep the message box focused: on first render and again each time the AI
  // finishes replying (the input is disabled while loading, so re-focus once it
  // re-enables) — the user never has to click back into it.
  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  // Welcome message only after the DB fetch has settled and the chat is empty.
  // Waiting on `fetched` avoids a race where an empty GET /chat response wipes
  // the welcome message right after it's added (blank chat on new accounts).
  useEffect(() => {
    if (fetched && !initialized.current && messages.length === 0) {
      initialized.current = true;
      dispatch(addMessage({ role: "ai", text: WELCOME_MSG }));
      dispatch(saveMessageThunk({ role: "ai", text: WELCOME_MSG }));
    }
  }, [fetched, messages.length, dispatch]);

  // Auto-send measurement update messages
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg?.role === "user" &&
      lastMsg.text.startsWith("[تحديث القياسات]") &&
      !autoSendRef.current &&
      !isLoading
    ) {
      autoSendRef.current = true;
      sendToAI(lastMsg.text);
    }
  }, [messages]);

  // Auto-build the plan the moment the goal is confirmed — no throwaway "build it"
  // message needed. When the last AI message is the confirmation line (and carries
  // no plan JSON yet), re-send the history so the server builds the plan this turn.
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg?.role === "ai" &&
      lastMsg.text.includes(GOAL_CONFIRMATION_MARKER) &&
      !parsePlanFromText(lastMsg.text) &&
      !autoBuildRef.current &&
      !isLoading
    ) {
      autoBuildRef.current = true;
      sendToAI(lastMsg.text);
    }
  }, [messages, isLoading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Calls the AI; on a rate-limit (429) shows a transient busy notice, waits the
  // server-advised time, then retries — up to 2 times. The wait honors Groq's
  // Retry-After (the per-minute token window can take up to ~60s to reset, which
  // is exactly what the big plan-build turn hits), plus a small buffer so the
  // minute has definitely rolled over. Capping at 10s (the old behavior) made the
  // retry fire before the budget freed, so the plan-build always failed and the
  // user had to resend manually. The notice is UI only — never added to
  // `messages`, so it costs no tokens on later turns.
  const MAX_RATE_LIMIT_RETRIES = 2;
  const callAIWithRetry = async (history: { role: string; text: string }[]): Promise<string> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await askGemini(history);
      } catch (e) {
        const err = e as { status?: number; retryAfter?: number };
        if (err?.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
          const waitSec = Math.min(err.retryAfter ?? 8, 65) + 2;
          // A long wait means the per-minute budget is resetting (plan-build turn);
          // reassure the user their plan is being built rather than "service busy".
          setRetryNotice(waitSec > 12 ? BUILD_MSG : BUSY_MSG);
          await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
          setRetryNotice(null);
          continue; // retry; if attempts run out, the caller shows FAIL_MSG
        }
        throw e;
      }
    }
  };

  const sendToAI = async (text: string) => {
    dispatch(setLoading(true));
    try {
      const reply = await callAIWithRetry(messages.map((m) => ({ role: m.role, text: m.text })));
      dispatch(addMessage({ role: "ai", text: reply }));
      dispatch(saveMessageThunk({ role: "ai", text: reply }));
      handleParsedPlan(reply, false);
    } catch {
      dispatch(addMessage({ role: "ai", text: FAIL_MSG }));
      dispatch(saveMessageThunk({ role: "ai", text: FAIL_MSG }));
    } finally {
      dispatch(setLoading(false));
      setRetryNotice(null);
      autoSendRef.current = false;
      // autoBuildRef is intentionally NOT reset here — it fires once per session so
      // a build turn that comes back without JSON can't trigger an auto-retry loop.
    }
  };

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setInput("");

    dispatch(addMessage({ role: "user", text }));
    dispatch(saveMessageThunk({ role: "user", text }));

    dispatch(setLoading(true));
    try {
      const reply = await callAIWithRetry([
        ...messages.map((m) => ({ role: m.role, text: m.text })),
        { role: "user", text },
      ]);
      dispatch(addMessage({ role: "ai", text: reply }));
      dispatch(saveMessageThunk({ role: "ai", text: reply }));
      handleParsedPlan(reply, true);
    } catch {
      dispatch(addMessage({ role: "ai", text: FAIL_MSG }));
      dispatch(saveMessageThunk({ role: "ai", text: FAIL_MSG }));
    } finally {
      dispatch(setLoading(false));
      setRetryNotice(null);
    }
  };

  // Extracts plan JSON from AI response and persists to DB
  const handleParsedPlan = (reply: string, isFirstSetup: boolean) => {
    const parsed = parsePlanFromText(reply);
    if (!parsed) return;

    if (parsed.profile) {
      // The AI's profile template always emits body measurements as empty strings
      // ("chest":"", ...). Without stripping them, every plan parse would overwrite
      // the measurements the user set on the Progress page. Drop empty/blank fields
      // so the AI can only ever ADD real values, never wipe existing ones.
      const cleanedProfile = Object.fromEntries(
        Object.entries(parsed.profile).filter(([, v]) => v !== "" && v != null)
      ) as Partial<typeof parsed.profile>;

      // Goal-specific target(s) pulled out of confirmedGoal (goal redesign —
      // single-tier now, only 6 possible fields: mainTargetWeight,
      // mainTargetBodyFatPct, mainTargetBenchPress, mainTargetSquat,
      // mainTargetDeadlift, mainTargetOverheadPress). Only the ones relevant
      // to this user's goal are non-null; the rest come back null from the AI
      // and are dropped here so they never overwrite anything. Values arrive
      // as numbers but UserProfile stores them as strings, matching every
      // other numeric field on the profile.
      const confirmedTargets = parsed.confirmedGoal
        ? Object.fromEntries(
            Object.entries(parsed.confirmedGoal)
              .filter(([, v]) => v !== null && v !== undefined)
              .map(([k, v]) => [k, String(v)])
          )
        : {};
      const hasConfirmedTargets = Object.keys(confirmedTargets).length > 0;

      const profileData = {
        ...cleanedProfile,
        ...confirmedTargets,
        hasCompletedSetup: true,
        // FIX (goal redesign) — only flip this on when confirmedGoal actually
        // contained real data, not just whenever the AI included the key at
        // all (which could be an all-null object if it forgot to fill it in —
        // that used to silently mark the goal "confirmed" with nothing behind
        // it). Never send `false` here either way, so a later unrelated save
        // can't un-confirm it.
        ...(hasConfirmedTargets ? { goalConfirmedByAI: true } : {}),
      };
      dispatch(setProfile(profileData));
      dispatch(completeSetup());
      dispatch(saveProfileThunk(profileData));

      if (parsed.profile.weight) {
        const weight = parseFloat(parsed.profile.weight);
        const label  = isFirstSetup ? "البداية" : "تحديث";

        dispatch(addWeightEntry({ week: label, weight }));
        dispatch(addWeightEntryThunk({ weight }));
      }
    }

    if (parsed.workout) {
      dispatch(setWorkoutPlan(parsed.workout));
      if (parsed.workout.weeklyPlan) {
        dispatch(saveWorkoutThunk(parsed.workout.weeklyPlan));
      }
    }

    if (parsed.nutrition) {
      // Show targets instantly (no meals yet), then generate the 7-day meal plan.
      dispatch(setNutritionPlan({ ...parsed.nutrition, meals: [] }));
      dispatch(generateMealPlanThunk({
        totalCalories: parsed.nutrition.totalCalories,
        protein:       parsed.nutrition.protein,
        carbs:         parsed.nutrition.carbs,
        fat:           parsed.nutrition.fat,
      }));
    }

    dispatch(setSetupComplete());
    // NOTE: generating/updating the plan is NOT a "commitment day" — the streak
    // only counts real activity (completing a workout or logging a meal), so we
    // deliberately do NOT mark active here. Otherwise a measurements update
    // (which resends [تحديث القياسات] and re-parses the plan) would bump it.
  };

  // Clear chat both locally and on the server
  const handleClearChat = () => {
    dispatch(clearChat());
    dispatch(clearChatThunk());
    dispatch(resetWorkout());
    dispatch(resetNutrition());
    setShowConfirm(false);
    setTimeout(() => {
      dispatch(addMessage({ role: "ai", text: WELCOME_MSG }));
      dispatch(saveMessageThunk({ role: "ai", text: WELCOME_MSG }));
    }, 100);
  };

  const quickReplies = setupComplete
    ? ["كيف أحسّن أدائي؟", "هل يمكنني تعديل الخطة؟", "ما أفضل وقت للتمرين؟"]
    : [];

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col px-6 pt-24 pb-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">المساعد الذكي 🤖</h1>
          <p className="text-xs text-slate-500">
            {setupComplete ? "خطتك جاهزة — يمكنك الآن طرح أي سؤال" : "سيسألك بعض الأسئلة لبناء خطتك"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {setupComplete && (
            <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              الخطة مكتملة ✅
            </span>
          )}
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:border-red-500/30 hover:text-red-400 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" /> مسح
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-bold">هل أنت متأكد؟</span>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            سيتم مسح المحادثة وخطة التمارين والتغذية. هذا الإجراء لا يمكن التراجع عنه.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleClearChat}
              className="flex-1 rounded-xl bg-red-500/20 py-2 text-xs font-bold text-red-400 hover:bg-red-500/30 transition-all"
            >
              نعم، امسح كل شي
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 rounded-xl border border-white/10 py-2 text-xs text-slate-400 hover:text-white transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-bg-card p-5">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
            {m.role === "ai" && (
              <div className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-sm">
                🤖
              </div>
            )}
            <div className={cn(
              "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
              m.role === "user"
                ? m.text.startsWith("[تحديث القياسات]")
                  ? "border border-brand-blue/30 bg-brand-blue/10 text-brand-blue"
                  : "border border-accent/30 bg-accent/10 text-accent"
                : "border border-white/10 bg-bg text-slate-200"
            )}>
              {m.text.startsWith("[تحديث القياسات]")
                ? m.text.replace("[تحديث القياسات]\n", "📏 تحديث القياسات:\n")
                : m.text.replace(/```json[\s\S]*?```/g, "\n✅ تم إنشاء خطتك بنجاح! راجع صفحات التمارين والتغذية.")}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-end">
            <div className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-sm">
              🤖
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-bg px-5 py-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> {retryNotice ?? "جاري الكتابة..."}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {quickReplies.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {quickReplies.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-full border border-white/10 bg-bg-card px-3 py-1.5 text-xs text-slate-400 transition-all hover:border-accent/30 hover:text-accent"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-3">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
          placeholder="اكتب رسالتك هنا..."
          disabled={isLoading}
          className="flex-1 rounded-xl border border-white/10 bg-bg-card px-5 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-accent/50 disabled:opacity-50"
        />
        <button
          onClick={() => send(input)}
          disabled={isLoading || !input.trim()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-accent text-bg transition-all hover:opacity-90 glow disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}