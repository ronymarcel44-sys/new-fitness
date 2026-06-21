// src/app/store.ts
import { configureStore } from "@reduxjs/toolkit";
import authReducer      from "@/features/auth/authSlice";
import userReducer      from "@/features/user/userSlice";
import workoutReducer   from "@/features/workout/workoutSlice";
import nutritionReducer from "@/features/nutrition/nutritionSlice";
import chatReducer      from "@/features/chat/chatSlice";
import progressReducer  from "@/features/progress/progressSlice";
import adminReducer     from "@/features/admin/adminSlice";
import coachReducer     from "@/features/coach/coachSlice"; // [added] Step 10
import messagesReducer  from "@/features/messages/messagesSlice"; // coach chat
import notificationsReducer from "@/features/notifications/notificationsSlice";

// The auth session (tokens + identity) is persisted to localStorage so the user
// stays logged in across a full page reload — critical for the Stripe Checkout
// flow, which redirects the browser away from the app and back again. All other
// slices are rebuilt from the backend on load (see App.tsx startup fetches).
const AUTH_KEY = "fitai_auth";

function loadAuthState() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return undefined;
    const auth = JSON.parse(raw);
    // Never restore transient request flags
    return { auth: { ...auth, isLoading: false, error: "" } };
  } catch {
    return undefined;
  }
}

export const store = configureStore({
  reducer: {
    auth:      authReducer,
    user:      userReducer,
    workout:   workoutReducer,
    nutrition: nutritionReducer,
    chat:      chatReducer,
    progress:  progressReducer,
    admin:     adminReducer,
    coach:     coachReducer, // [added]
    messages:  messagesReducer,
    notifications: notificationsReducer,
  },
  preloadedState: loadAuthState(),
});

// Keep localStorage in sync with the auth slice (login, token refresh, logout).
store.subscribe(() => {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(store.getState().auth));
  } catch {
    // Ignore quota / serialization errors — a failed persist just means the
    // session won't survive a reload, which is non-fatal.
  }
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
