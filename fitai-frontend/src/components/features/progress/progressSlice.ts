// src/features/progress/progressSlice.ts
//
// Changes from Phase 2:
// - fetchProgressThunk:   GET /progress  — reload weight history on app start
// - addWeightEntryThunk:  POST /progress — save new entry (upserts by date)
// - All sync actions preserved for instant UI feedback

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { apiRequest } from "@/lib/api";
import type { WeightEntry } from "@/types";
import { STREAK_LADDER } from "@/lib/goalTracker";
import { celebrate } from "@/features/celebration/celebrationSlice";

interface BackendProgressEntry {
  id:        string;
  entryDate: string;
  weight:    number;
  chest:     number | null;
  waist:     number | null;
  hips:      number | null;
  arms:      number | null;
  legs:      number | null;
}

// Convert DB entries to chart labels
function backendToWeightEntries(entries: BackendProgressEntry[]): WeightEntry[] {
  return entries.map((e, idx) => ({
    week:   idx === 0 ? "البداية" : `تحديث ${idx}`,
    weight: e.weight,
  }));
}

// ── Async Thunks ──────────────────────────────────────────────────────────────

interface ProgressLoad {
  weight: WeightEntry[];
  waist:  number[];   // waist history (cm), oldest first — for the recomposition goal
}

export const fetchProgressThunk = createAsyncThunk<ProgressLoad, void>(
  "progress/fetch",
  async () => {
    const entries = await apiRequest<BackendProgressEntry[]>("GET", "/progress");
    return {
      weight: backendToWeightEntries(entries),
      waist:  entries.map((e) => e.waist).filter((w): w is number => w != null),
    };
  }
);

// Saves to DB — backend upserts by (userId, date) so calling twice same day updates
export const addWeightEntryThunk = createAsyncThunk<
  void,
  { weight: number; chest?: string; waist?: string; hips?: string; arms?: string; legs?: string }
>(
  "progress/addEntry",
  async (data) => {
    await apiRequest("POST", "/progress", data);
  }
);

interface ActivityResponse {
  streak:         number;
  lastActiveDate: string;
  bestStreak:     number;
}

// Loads the persisted commitment streak on app startup.
export const fetchActivityThunk = createAsyncThunk<ActivityResponse, void>(
  "progress/fetchActivity",
  async () => apiRequest<ActivityResponse>("GET", "/progress/activity")
);

// Marks the user active today; the backend computes and returns the new streak.
// If that activity just crossed a streak milestone, fire a celebration toast.
export const markActiveTodayThunk = createAsyncThunk<ActivityResponse, void>(
  "progress/markActive",
  async (_, { getState, dispatch }) => {
    const before = (getState() as { progress: { streak: number } }).progress.streak;
    const res = await apiRequest<ActivityResponse>("POST", "/progress/activity");
    if (res.streak > before && STREAK_LADDER.includes(res.streak)) {
      dispatch(celebrate({
        emoji:   "🔥",
        title:   "وسام جديد!",
        message: `${res.streak} يوم التزام متواصل — استمر!`,
      }));
    }
    return res;
  }
);

// ── State ─────────────────────────────────────────────────────────────────────

interface ProgressState {
  weightData:     WeightEntry[];
  waistData:      number[];
  streak:         number;
  lastActiveDate: string;
  bestStreak:     number;
}

const initialState: ProgressState = {
  weightData:     [],
  waistData:      [],
  streak:         0,
  lastActiveDate: "",
  bestStreak:     0,
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const progressSlice = createSlice({
  name: "progress",
  initialState,
  reducers: {
    addWeightEntry(state, action: PayloadAction<WeightEntry>) {
      state.weightData.push(action.payload);
    },

    resetProgress(state) {
      state.weightData     = [];
      state.streak         = 0;
      state.lastActiveDate = "";
    },
  },

  extraReducers: (builder) => {
    builder.addCase(fetchProgressThunk.fulfilled, (state, action) => {
      state.weightData = action.payload.weight;
      state.waistData  = action.payload.waist;
    });
    // Streak comes from the server (startup load + after each activity)
    builder.addCase(fetchActivityThunk.fulfilled, (state, action) => {
      state.streak         = action.payload.streak;
      state.lastActiveDate = action.payload.lastActiveDate;
      state.bestStreak     = action.payload.bestStreak;
    });
    builder.addCase(markActiveTodayThunk.fulfilled, (state, action) => {
      state.streak         = action.payload.streak;
      state.lastActiveDate = action.payload.lastActiveDate;
      state.bestStreak     = action.payload.bestStreak;
    });
  },
});

export const { addWeightEntry, resetProgress } = progressSlice.actions;
export default progressSlice.reducer;