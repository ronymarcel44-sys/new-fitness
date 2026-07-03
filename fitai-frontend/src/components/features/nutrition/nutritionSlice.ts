// src/features/nutrition/nutritionSlice.ts
//
// Changes from Phase 2:
// - fetchNutritionThunk: GET /nutrition — reload plan on app start
// - saveNutritionThunk:  POST /nutrition — save AI plan to DB
// - fetchMealLogsThunk:  GET /nutrition/logs — reload today's logs
// - logMealThunk:        POST /nutrition/logs — persist a meal log
// - removeMealLogThunk:  DELETE /nutrition/logs/:id
// - All existing synchronous actions preserved for instant UI feedback

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { apiRequest } from "@/lib/api";
import type { NutritionPlan, Meal } from "@/types";
import { markActiveTodayThunk } from "@/features/progress/progressSlice";

interface BackendMeal {
  id:       string;
  mealName: string;
  mealTime: string;
  calories: number;
  proteinG: number;
  carbsG:   number;
  fatG:     number;
  items:    string[];
  emoji:    string | null;
  coachEdited: boolean;
  dayOfWeek?:  string | null;
}

interface BackendPlan {
  id:            string;
  totalCalories: number;
  proteinGrams:  number;
  carbsGrams:    number;
  fatGrams:      number;
  meals:         BackendMeal[];
}

interface BackendMealLog {
  id:       string;
  mealId:   string | null;
  calories: number;
  proteinG: number;
  carbsG:   number;
  fatG:     number;
  loggedAt: string;
  name?:    string;
  source?:  string | null;
}

// Convert backend plan to the frontend NutritionPlan shape
function backendToFrontendPlan(plan: BackendPlan): NutritionPlan {
  return {
    totalCalories: plan.totalCalories,
    protein:       plan.proteinGrams,
    carbs:         plan.carbsGrams,
    fat:           plan.fatGrams,
    meals: plan.meals.map((m) => ({
      id:       m.id,
      name:     m.mealName,
      time:     m.mealTime,
      calories: m.calories,
      protein:  m.proteinG,
      carbs:    m.carbsG,
      fat:      m.fatG,
      items:    m.items,
      emoji:    m.emoji ?? "🍽️",
      coachEdited: m.coachEdited,
      dayOfWeek: m.dayOfWeek ?? undefined,
    })),
  };
}

function backendLogToMeal(log: BackendMealLog): Meal {
  return {
    id:       log.id,
    name:     log.name || "وجبة",
    calories: log.calories,
    protein:  log.proteinG,
    carbs:    log.carbsG,
    fat:      log.fatG,
    time:     new Date(log.loggedAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
    items:    [],
    emoji:    "🍽️",
    source:   (log.source ?? undefined) as Meal["source"],
  };
}

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const fetchNutritionThunk = createAsyncThunk<NutritionPlan | null, void>(
  "nutrition/fetch",
  async () => {
    const plan = await apiRequest<BackendPlan | null>("GET", "/nutrition");
    return plan ? backendToFrontendPlan(plan) : null;
  }
);

export const saveNutritionThunk = createAsyncThunk<void, NutritionPlan>(
  "nutrition/save",
  async (plan) => {
    await apiRequest("POST", "/nutrition", {
      totalCalories: plan.totalCalories,
      protein:       plan.protein,
      carbs:         plan.carbs,
      fat:           plan.fat,
      meals:         plan.meals,
    });
  }
);

// Generate + save the 7-day meal plan from the daily targets (server picks foods,
// computes macros to match the targets). Returns the full plan for state.
export const generateMealPlanThunk = createAsyncThunk<
  NutritionPlan,
  { totalCalories: number; protein: number; carbs: number; fat: number }
>(
  "nutrition/generateMealPlan",
  async (targets) => {
    const plan = await apiRequest<BackendPlan>("POST", "/ai/generate-meal-plan", targets);
    return backendToFrontendPlan(plan);
  }
);

export const fetchMealLogsThunk = createAsyncThunk<Meal[], void>(
  "nutrition/fetchLogs",
  async () => {
    const logs = await apiRequest<BackendMealLog[]>("GET", "/nutrition/logs");
    return logs.map(backendLogToMeal);
  }
);

export const logMealThunk = createAsyncThunk<Meal, Meal>(
  "nutrition/logMeal",
  async (meal, { dispatch }) => {
    const body = {
      mealId:   null,
      name:     meal.name,
      source:   meal.source,
      calories: meal.calories,
      protein:  meal.protein,
      carbs:    meal.carbs,
      fat:      meal.fat,
    };
    const saved = await apiRequest<BackendMealLog>("POST", "/nutrition/logs", body);
    // Re-evaluate today's commitment. The backend only bumps the streak when BOTH
    // the meals (calorie target) AND the workout are done today, and is idempotent
    // per day — so this fires on every meal log but counts the day at most once.
    dispatch(markActiveTodayThunk());
    return backendLogToMeal({ ...saved, name: meal.name });
  }
);

export const removeMealLogThunk = createAsyncThunk<string, string>(
  "nutrition/removeLog",
  async (logId) => {
    await apiRequest("DELETE", `/nutrition/logs/${logId}`);
    return logId;
  }
);

// ── State ─────────────────────────────────────────────────────────────────────

interface DailyLogEntry {
  date:  string;
  meals: Meal[];
}

interface NutritionState {
  plan:        NutritionPlan | null;
  dailyLog:    Meal[];
  logDate:     string;
  history:     DailyLogEntry[];
  waterIntake: number;   // cups of water logged today
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const initialState: NutritionState = {
  plan:        null,
  dailyLog:    [],
  logDate:     today(),
  history:     [],
  waterIntake: 0,
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const nutritionSlice = createSlice({
  name: "nutrition",
  initialState,
  reducers: {
    setPlan(state, action: PayloadAction<NutritionPlan>) {
      state.plan = action.payload;
    },

    resetPlan(state) {
      state.plan        = null;
      state.dailyLog    = [];
      state.logDate     = today();
      state.history     = [];
      state.waterIntake = 0;
    },

    checkDayReset(state) {
      const t = today();
      if (state.logDate !== t) {
        if (state.dailyLog.length > 0) {
          state.history.push({ date: state.logDate, meals: state.dailyLog });
          if (state.history.length > 30) state.history.shift();
        }
        state.dailyLog = [];
        state.logDate  = t;
        state.waterIntake = 0;
      }
    },

    logMeal(state, action: PayloadAction<Meal>) {
      const t = today();
      if (state.logDate !== t) {
        if (state.dailyLog.length > 0) {
          state.history.push({ date: state.logDate, meals: state.dailyLog });
          if (state.history.length > 30) state.history.shift();
        }
        state.dailyLog = [];
        state.logDate  = t;
        state.waterIntake = 0;
      }
      state.dailyLog.push(action.payload);
    },

    removeMealLog(state, action: PayloadAction<string>) {
      state.dailyLog = state.dailyLog.filter((m) => m.id !== action.payload);
    },

    addWater(state, action: PayloadAction<number>) {
      state.waterIntake += action.payload;
    },

    removeWater(state) {
      if (state.waterIntake > 0) state.waterIntake -= 1;
    },
  },

  extraReducers: (builder) => {
    builder.addCase(fetchNutritionThunk.fulfilled, (state, action) => {
      if (action.payload) state.plan = action.payload;
    });

    builder.addCase(generateMealPlanThunk.fulfilled, (state, action) => {
      state.plan = action.payload;
    });

    builder.addCase(fetchMealLogsThunk.fulfilled, (state, action) => {
      state.dailyLog = action.payload;
      state.logDate  = today();
    });

    builder.addCase(logMealThunk.fulfilled, (state, action) => {
      // Remove any optimistic entry and add the DB version with real ID
      state.dailyLog = state.dailyLog.filter((m) => m.id !== action.payload.id);
      state.dailyLog.push(action.payload);
    });

    builder.addCase(removeMealLogThunk.fulfilled, (state, action) => {
      state.dailyLog = state.dailyLog.filter((m) => m.id !== action.payload);
    });
  },
});

export const { setPlan, resetPlan, checkDayReset, logMeal, removeMealLog, addWater, removeWater } = nutritionSlice.actions;
export default nutritionSlice.reducer;