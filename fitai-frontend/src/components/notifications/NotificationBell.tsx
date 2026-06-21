// src/components/notifications/NotificationBell.tsx
// Bell + dropdown of recent notifications. Works for both users and coaches.
// Polls the unread count; opening the dropdown loads the list and marks all read.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, MessageCircle, UserPlus } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  fetchNotificationsThunk,
  fetchNotifUnreadThunk,
  markNotifsReadThunk,
} from "@/features/notifications/notificationsSlice";
import { setChatOpen } from "@/features/messages/messagesSlice";
import type { AppNotification } from "@/types";

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.floor(h / 24)} ي`;
}

export function NotificationBell() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { list, unreadCount } = useAppSelector((s) => s.notifications);
  const [open, setOpen] = useState(false);

  // Poll the unread count
  useEffect(() => {
    dispatch(fetchNotifUnreadThunk());
    const id = setInterval(() => dispatch(fetchNotifUnreadThunk()), 20000);
    return () => clearInterval(id);
  }, [dispatch]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      dispatch(fetchNotificationsThunk());
      dispatch(markNotifsReadThunk());
    }
  };

  const handleClick = (n: AppNotification) => {
    setOpen(false);
    if (n.link) navigate(n.link);
    else dispatch(setChatOpen(true)); // message to a user with no route → open chat bubble
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-white/5 hover:text-white"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* backdrop to close on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-white/10 bg-bg-card shadow-2xl" dir="rtl">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="text-sm font-bold text-white">الإشعارات</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {list.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">لا توجد إشعارات</div>
              ) : (
                list.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-right transition-colors hover:bg-white/5 ${
                      n.read ? "" : "bg-brand-purple/5"
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-purple/15 text-brand-purple">
                      {n.type === "new_client" ? <UserPlus className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-slate-200">{n.text}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
