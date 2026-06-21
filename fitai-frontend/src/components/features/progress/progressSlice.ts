// src/features/progress/progressSlice.ts
//
// Changes from Phase 2:
// - fetchProgressThunk:   GET /progress  — reload weight history on app start
// - addWeightEntryThunk:  POST /progress — save new entry (upserts by date)
// - All sync actions preserved for instant UI feedback

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { apiRequest } from "@/lib/api";
import type { WeightEntry } from "@/types";

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

export const fetchProgressThunk = createAsyncThunk<WeightEntry[], void>(
  "progress/fetch",
  async () => {
    const entries = await apiRequest<BackendProgressEntry[]>("GET", "/progress");
    return backendToWeightEntries(entries);
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

// ── State ─────────────────────────────────────────────────────────────────────

interface ProgressState {
  weightData:     WeightEntry[];
  streak:         number;
  lastActiveDate: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const initialState: ProgressState = {
  weightData:     [],
  streak:         0,
  lastActiveDate: "",
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const progressSlice = createSlice({
  name: "progress",
  initialState,
  reducers: {
    addWeightEntry(state, action: PayloadAction<WeightEntry>) {
      state.weightData.push(action.payload);
    },

    setStreak(state, action: PayloadAction<number>) {
      state.streak = action.payload;
    },

    markActiveToday(state) {
      const t = today();
      if (state.lastActiveDate === t) return;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      if (state.lastActiveDate === yesterdayStr) {
        state.streak += 1;
      } else if (state.lastActiveDate !== t) {
        state.streak = 1;
      }
      state.lastActiveDate = t;
    },

    resetProgress(state) {
      state.weightData     = [];
      state.streak         = 0;
      state.lastActiveDate = "";
    },
  },

  extraReducers: (builder) => {
    builder.addCase(fetchProgressThunk.fulfilled, (state, action) => {
      state.weightData = action.payload;
    });
  },
});

export const { addWeightEntry, setStreak, markActiveToday, resetProgress } = progressSlice.actions;
export default progressSlice.reducer;