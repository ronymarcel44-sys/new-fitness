// src/features/workout/workoutSlice.ts
//
// Changes from Phase 2:
// - Added fetchWorkoutThunk: GET /workout  — loads plan from DB on app start
// - Added saveWorkoutThunk:  POST /workout — saves AI plan to DB after generation
// - All existing synchronous actions (setPlan, toggleDone, etc.) are unchanged
//   because WorkoutPage and ExerciseDetailPage still use them directly.
// - toggleDoneThunk added: PATCH /workout/exercises/:id/done — persists checkbox
//   state to DB so "done" ticks survive page refresh too.

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { apiRequest } from "@/lib/api";
import type { WorkoutPlan, WeeklyPlan, DayName, Exercise } from "@/types";
import { DAYS_ORDER } from "@/types";

// Shape of one exercise row as the backend stores and returns it
interface BackendExercise {
  id:          string;
  dayOfWeek:   string;
  dayType:     string;
  focus:       string | null;
  nameAr:      string;
  nameEn:      string;
  sets:        string;
  reps:        string;
  restSeconds: number;
  weight:      string | null;
  notes:       string | null;
  muscleGroup: string;
  sortOrder:   number;
  done:        boolean;
  coachEdited: boolean;
}

interface BackendPlan {
  id:        string;
  exercises: BackendExercise[];
}

// Convert backend flat exercise rows back into the WeeklyPlan object shape
// that all the existing frontend components expect
function backendToWeeklyPlan(plan: BackendPlan): WeeklyPlan {
  const weekly = {} as WeeklyPlan;

  // Initialize all 7 days as rest days first
  DAYS_ORDER.forEach((day) => {
    weekly[day] = { type: "راحة", focus: "", exercises: [] };
  });

  // Fill in the exercises grouped by day
  plan.exercises.forEach((ex) => {
    const day = ex.dayOfWeek as DayName;
    if (!weekly[day]) return;

    // Mark the day as training if any of its rows are training.
    if (ex.dayType === "training") {
      weekly[day].type = "تمرين";
    }
    // Capture focus from the first row that has one — including rest days, so a
    // rest day keeps its focus label when it's switched to training after a reload.
    if (!weekly[day].focus && ex.focus) {
      weekly[day].focus = ex.focus;
    }

    // Convert backend row back to the Exercise shape the frontend uses
    const exercise: Exercise = {
      id:          ex.id,          // use the real DB id — needed for PATCH /exercises/:id/done
      name:        ex.nameAr,
      nameEn:      ex.nameEn,
      sets:        ex.sets,
      reps:        ex.reps,
      rest:        `${ex.restSeconds} ثانية`,
      weight:      ex.weight      ?? "",
      notes:       ex.notes       ?? "",
      muscleGroup: ex.muscleGroup,
      done:        ex.done,
      coachEdited: ex.coachEdited,
    };

    weekly[day].exercises.push(exercise);
  });

  return weekly;
}

// ── Async Thunks ──────────────────────────────────────────────────────────────

// Load the active plan from the database on app start / page refresh
export const fetchWorkoutThunk = createAsyncThunk<
  WeeklyPlan | null,
  void,
  { rejectValue: string }
>(
  "workout/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const plan = await apiRequest<BackendPlan | null>("GET", "/workout");
      if (!plan) return null;
      return backendToWeeklyPlan(plan);
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : "Failed to load workout");
    }
  }
);

// Save a new AI-generated plan to the database
// Called in ChatPage right after setPlan() so the UI updates instantly
// and the DB is updated in the background
export const saveWorkoutThunk = createAsyncThunk<
  void,
  WeeklyPlan,
  { rejectValue: string }
>(
  "workout/save",
  async (weeklyPlan, { rejectWithValue }) => {
    try {
      await apiRequest("POST", "/workout", { weeklyPlan });
    } catch (err) {
      console.error("Failed to save workout plan:", err);
      return rejectWithValue(err instanceof Error ? err.message : "Failed to save workout");
    }
  }
);

// Persist the done/undone toggle to the database
// Called alongside the existing toggleDone action so the checkbox state
// also survives page refresh
export const toggleDoneThunk = createAsyncThunk<
  void,
  { exerciseId: string; done: boolean },
  { rejectValue: string }
>(
  "workout/toggleDone",
  async ({ exerciseId, done }, { rejectWithValue }) => {
    try {
      await apiRequest("PATCH", `/workout/exercises/${exerciseId}/done`, { done });
    } catch (err) {
      console.error("Failed to toggle exercise done:", err);
      return rejectWithValue(err instanceof Error ? err.message : "Failed to update exercise");
    }
  }
);

// Persist a whole-day rest/training switch to the database. Dispatched alongside
// the synchronous toggleDayType action (which already flipped the UI instantly).
export const toggleDayTypeThunk = createAsyncThunk<
  void,
  { day: DayName; type: "تمرين" | "راحة" },
  { rejectValue: string }
>(
  "workout/toggleDayType",
  async ({ day, type }, { rejectWithValue }) => {
    try {
      await apiRequest("PATCH", "/workout/days/type", { day, type });
    } catch (err) {
      console.error("Failed to persist day type:", err);
      return rejectWithValue(err instanceof Error ? err.message : "Failed to update day type");
    }
  }
);

// ── State ─────────────────────────────────────────────────────────────────────

type SetRecord      = Record<string, string[]>;
type CompletedSets  = Record<string, number[]>;

interface WorkoutState {
  weeklyPlan:    WeeklyPlan | null;
  selectedDay:   DayName;
  setWeights:    SetRecord;
  completedSets: CompletedSets;
}

const TODAY = DAYS_ORDER[new Date().getDay()];

const initialState: WorkoutState = {
  weeklyPlan:    null,
  selectedDay:   TODAY,
  setWeights:    {},
  completedSets: {},
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const workoutSlice = createSlice({
  name: "workout",
  initialState,
  reducers: {
    // Saves the plan to Redux state — still called synchronously in ChatPage
    // for instant UI update. saveWorkoutThunk persists it to the DB in parallel.
    setPlan(state, action: PayloadAction<WorkoutPlan>) {
      const { weeklyPlan, exercises } = action.payload;

      if (weeklyPlan) {
        state.weeklyPlan = weeklyPlan;
      } else if (exercises && exercises.length > 0) {
        // Legacy: old AI responses sent a flat exercises array instead of weeklyPlan
        const trainingDays: DayName[] = ["الأحد", "الاثنين", "الأربعاء", "الخميس"];
        const restDays:     DayName[] = ["الثلاثاء", "الجمعة", "السبت"];
        const perDay = Math.ceil(exercises.length / trainingDays.length);
        const plan   = {} as WeeklyPlan;
        trainingDays.forEach((day, i) => {
          const slice   = exercises.slice(i * perDay, (i + 1) * perDay);
          const muscles = [...new Set(slice.map((e) => e.muscleGroup).filter(Boolean))];
          plan[day] = { type: "تمرين", focus: muscles.join(" و") || "تمارين متنوعة", exercises: slice };
        });
        restDays.forEach((day) => { plan[day] = { type: "راحة", focus: "", exercises: [] }; });
        state.weeklyPlan = plan;
      }

      state.setWeights    = {};
      state.completedSets = {};
    },

    // Toggle done locally — UI updates instantly without waiting for the DB.
    // Dispatch toggleDoneThunk alongside this to persist the change.
    toggleDone(state, action: PayloadAction<{ day: DayName; exerciseId: string }>) {
      const day = state.weeklyPlan?.[action.payload.day];
      if (!day) return;
      const ex = day.exercises.find((e) => e.id === action.payload.exerciseId);
      if (ex) ex.done = !ex.done;
    },

    saveSetWeight(state, action: PayloadAction<{ exerciseId: string; setIdx: number; weight: string }>) {
      const { exerciseId, setIdx, weight } = action.payload;
      if (!state.setWeights[exerciseId]) state.setWeights[exerciseId] = [];
      state.setWeights[exerciseId][setIdx] = weight;
    },

    completeSet(state, action: PayloadAction<{ exerciseId: string; setIdx: number }>) {
      const { exerciseId, setIdx } = action.payload;
      if (!state.completedSets[exerciseId]) state.completedSets[exerciseId] = [];
      if (!state.completedSets[exerciseId].includes(setIdx)) {
        state.completedSets[exerciseId].push(setIdx);
      }
    },

    resetExerciseSets(state, action: PayloadAction<string>) {
      delete state.completedSets[action.payload];
      delete state.setWeights[action.payload];
      if (!state.weeklyPlan) return;
      for (const day of DAYS_ORDER) {
        const ex = state.weeklyPlan[day].exercises.find((e) => e.id === action.payload);
        if (ex) { ex.done = false; break; }
      }
    },

    setSelectedDay(state, action: PayloadAction<DayName>) {
      state.selectedDay = action.payload;
    },

    toggleDayType(state, action: PayloadAction<DayName>) {
      const day = state.weeklyPlan?.[action.payload];
      if (day) day.type = day.type === "تمرين" ? "راحة" : "تمرين";
    },

    resetPlan(state) {
      state.weeklyPlan    = null;
      state.selectedDay   = TODAY;
      state.setWeights    = {};
      state.completedSets = {};
    },
  },

  extraReducers: (builder) => {
    // When fetchWorkoutThunk succeeds, populate the Redux state with DB data
    builder.addCase(fetchWorkoutThunk.fulfilled, (state, action) => {
      if (action.payload) {
        state.weeklyPlan = action.payload;
      }
    });

    // saveWorkoutThunk and toggleDoneThunk don't need to update Redux state —
    // the synchronous actions (setPlan, toggleDone) already did that instantly.
  },
});

export const {
  setPlan, toggleDone, saveSetWeight, completeSet,
  resetExerciseSets, setSelectedDay, toggleDayType, resetPlan,
} = workoutSlice.actions;

export default workoutSlice.reducer;