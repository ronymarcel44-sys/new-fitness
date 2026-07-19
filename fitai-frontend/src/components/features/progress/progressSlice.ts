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
  { weight: number; chest?: string; waist?: string; hips?: string; arms?: string; legs?: string; neck?: string } // neck added (Task 3)
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

// ── Goal summary (Task 6) — real progress vs the confirmed main+mini targets ──
// Mirrors fitai-backend/src/lib/progressReader.ts's GoalProgress/GoalMetric shape.
// "journey" metrics (body fat %, weight, lean mass) have a real start point and
// get run through goalTracker.ts's computeJourney/computeMilestones on render.
// "ratio" (endurance) and "lifts" (strength) have no start — just current vs target.
export interface JourneyMetric { kind: "journey"; unit: string; direction: "up" | "down"; start: number; current: number; target: number; }
export interface RatioMetric   { kind: "ratio";   unit: string; current: number; target: number; }
export interface LiftsMetric   { kind: "lifts";   unit: string; lifts: { label: string; current: number; target: number }[]; }
export type GoalMetric = JourneyMetric | RatioMetric | LiftsMetric;
export interface GoalSummary { goal: string; main: GoalMetric | null; mini: GoalMetric | null; }

// Returns null when the user hasn't been through the AI goal-confirmation flow —
// GoalJourneyCard falls back to the old weight/waist card in that case.
export const fetchGoalSummaryThunk = createAsyncThunk<GoalSummary | null, void>(
  "progress/fetchGoalSummary",
  async () => apiRequest<GoalSummary | null>("GET", "/progress/goal-summary")
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
  goalSummary:    GoalSummary | null; // NEW (Task 6)
}

const initialState: ProgressState = {
  weightData:     [],
  waistData:      [],
  streak:         0,
  lastActiveDate: "",
  bestStreak:     0,
  goalSummary:    null, // NEW (Task 6)
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
    // NEW (Task 6)
    builder.addCase(fetchGoalSummaryThunk.fulfilled, (state, action) => {
      state.goalSummary = action.payload;
    });
  },
});

export const { addWeightEntry, resetProgress } = progressSlice.actions;
export default progressSlice.reducer;