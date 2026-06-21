// src/components/chat/CoachChatBubble.tsx
//
// Floating chat bubble (bottom-left) for a premium user to message their coach.
// Only rendered for premium users who have an assigned coach. Shows an unread
// badge, and polls for new messages (every 5s while open, 20s while closed).

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  fetchMessagesThunk,
  fetchUnreadCountThunk,
  sendMessageThunk,
  setChatOpen,
} from "@/features/messages/messagesSlice";
import { CoachAvatar } from "@/components/coach/CoachAvatar";

export function CoachChatBubble() {
  const dispatch = useAppDispatch();
  const plan  = useAppSelector((s) => s.user.profile.plan);
  const coach = useAppSelector((s) => s.user.coach);
  const { thread, unreadCount, open } = useAppSelector((s) => s.messages);

  const [draft, setDraft]   = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const show = plan === "premium" && !!coach;

  // Initial unread count
  useEffect(() => {
    if (show) dispatch(fetchUnreadCountThunk());
  }, [show, dispatch]);

  // Poll: thread while open (5s), unread badge while closed (20s)
  useEffect(() => {
    if (!show) return;
    const tick = () => { if (open) dispatch(fetchMessagesThunk()); else dispatch(fetchUnreadCountThunk()); };
    const id = setInterval(tick, open ? 5000 : 20000);
    return () => clearInterval(id);
  }, [show, open, dispatch]);

  // Auto-scroll to newest message
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length, open]);

  if (!show) return null;

  const openChat = () => {
    dispatch(setChatOpen(true));
    dispatch(fetchMessagesThunk());
  };
  const closeChat = () => dispatch(setChatOpen(false));

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    await dispatch(sendMessageThunk(text));
    setSending(false);
  };

  return (
    <div className="fixed bottom-6 left-6 z-50" dir="rtl">
      {/* Panel */}
      {open && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-white/10 bg-bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-brand-purple/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <CoachAvatar src={coach!.profileImage} name={coach!.name} size={36} />
              <div>
                <p className="text-sm font-bold text-white">{coach!.name}</p>
                <p className="text-[11px] text-emerald-400">● مدربك</p>
              </div>
            </div>
            <button onClick={closeChat} className="text-slate-500 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {thread.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-xs text-slate-500">
                ابدأ المحادثة مع مدربك — اسأله عن خطتك أو تقدمك 💬
              </div>
            ) : (
              thread.map((m) => (
                <div key={m.id} className={`flex ${m.senderRole === "user" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.senderRole === "user"
                        ? "bg-accent/20 text-white"
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

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-white/10 p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="اكتب رسالتك..."
              className="input-base flex-1 py-2 text-sm"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-purple text-white transition-all hover:bg-brand-purple/80 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      {!open && (
        <button
          onClick={openChat}
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-purple text-white shadow-lg shadow-brand-purple/30 transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-bg bg-red-500 px-1 text-xs font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
