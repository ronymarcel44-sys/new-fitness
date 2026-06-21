// src/pages/coach/CoachChat.tsx
// Coach's side of the chat with one assigned client (?user=<id>).

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, Loader2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { fetchCoachMessagesThunk, sendCoachMessageThunk } from "@/features/coach/coachSlice";

export function CoachChat() {
  const [searchParams] = useSearchParams();
  const dispatch       = useAppDispatch();
  const userId         = searchParams.get("user") ?? "";

  const { users, selectedUserMessages } = useAppSelector((s) => s.coach);
  const userName = users.find((u) => u.id === userId)?.name ?? "المستخدم";

  const [draft, setDraft]     = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Load thread on mount + poll for new client messages while open
  useEffect(() => {
    if (!userId) return;
    dispatch(fetchCoachMessagesThunk(userId));
    const id = setInterval(() => dispatch(fetchCoachMessagesThunk(userId)), 5000);
    return () => clearInterval(id);
  }, [userId, dispatch]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedUserMessages.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    await dispatch(sendCoachMessageThunk({ userId, text }));
    setSending(false);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* رأس الصفحة */}
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Coach Portal</p>
        <h1 className="mt-1 text-2xl font-black">محادثة — {userName}</h1>
      </div>

      {/* الرسائل */}
      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-bg-card p-4">
        {selectedUserMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
            لا توجد رسائل بعد — ابدأ بالتواصل مع متدربك 💬
          </div>
        ) : (
          selectedUserMessages.map((m) => (
            <div key={m.id} className={`flex ${m.senderRole === "coach" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.senderRole === "coach"
                    ? "bg-brand-purple/20 text-white"
                    : "bg-white/10 text-slate-200"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* الإدخال */}
      <div className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="اكتب رسالة لمتدربك..."
          className="input-base flex-1"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-purple text-white transition-all hover:bg-brand-purple/80 disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
