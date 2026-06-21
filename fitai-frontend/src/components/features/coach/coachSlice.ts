// src/features/coach/coachSlice.ts
//
// All data loaded from backend via thunks. No localStorage snapshots.

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { apiRequest } from "@/lib/api";
import type { CoachMessage, CoachEarnings } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CoachUser {
  id:           string;
  name:         string;
  email:        string;
  plan:         string;
  status:       string;
  weight:       number | null;
  goal:         string | null;
  fitnessLevel: string | null;
  hasWorkout:   boolean;
  hasNutrition: boolean;
  unreadMessages: number;
}

// A client's progress + adherence snapshot for the coach
export interface CoachUserProgress {
  weightHistory: { date: string; weight: number }[];
  startWeight:   number | null;
  latestWeight:  number | null;
  workout:       { done: number; total: number };
  mealLogDays:   number;
}

// The logged-in coach's own profile + verification status
export interface CoachMe {
  id:              string;
  name:            string;
  email:           string;
  specialty:       string;
  status:          "pending" | "active" | "inactive" | "rejected";
  bio:             string | null;
  yearsExperience: number | null;
  certification:   string | null;
  profileImage:    string | null;
}

export interface ExerciseNote {
  id:         string;
  exerciseId: string;
  userId:     string;
  noteText:   string;
} 

export interface MealNote {
  id:         string;
  mealId:     string;
  userId:     string;
  noteText:   string;
}

interface CoachState {
  me:                     CoachMe | null;  // own profile + verification status
  meLoaded:               boolean;         // true once /coach/me has resolved (avoids flicker)
  users:                  CoachUser[];
  selectedUserId:         string | null;
  selectedUserWorkout:    any | null;    // backend plan shape — already consumable
  selectedUserNutrition:  any | null;
  selectedUserMessages:   CoachMessage[]; // chat thread with the selected client
  selectedUserProgress:   CoachUserProgress | null; // progress + adherence snapshot
  earnings:               CoachEarnings | null;     // earnings + withdrawals
  exerciseNotes:          Record<string, ExerciseNote[]>; // userId -> notes
  mealNotes:              Record<string, MealNote[]>;     // userId -> notes
  isLoading:              boolean;
}

const initialState: CoachState = {
  me:                    null,
  meLoaded:              false,
  users:                 [],
  selectedUserId:        null,
  selectedUserWorkout:   null,
  selectedUserNutrition: null,
  selectedUserMessages:  [],
  selectedUserProgress:  null,
  earnings:              null,
  exerciseNotes:         {},
  mealNotes:             {},
  isLoading:             false,
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchCoachMeThunk = createAsyncThunk<CoachMe, void>(
  "coach/fetchMe",
  async () => apiRequest<CoachMe>("GET", "/coach/me")
);

export const fetchCoachUsersThunk = createAsyncThunk<CoachUser[], void>(
  "coach/fetchUsers",
  async () => apiRequest<CoachUser[]>("GET", "/coach/users")
);

// Coach edits their own profile (bio, specialty, experience, certification, photo)
export const updateCoachProfileThunk = createAsyncThunk<
  CoachMe,
  { name?: string; bio?: string; specialty?: string; yearsExperience?: string; certification?: string; profileImage?: string }
>(
  "coach/updateProfile",
  async (data) => apiRequest<CoachMe>("PATCH", "/coach/me", data)
);

export const fetchCoachUserWorkoutThunk = createAsyncThunk<any, string>(
  "coach/fetchUserWorkout",
  async (userId) => apiRequest("GET", `/coach/users/${userId}/workout`)
);

export const fetchCoachUserNutritionThunk = createAsyncThunk<any, string>(
  "coach/fetchUserNutrition",
  async (userId) => apiRequest("GET", `/coach/users/${userId}/nutrition`)
);

// Coach edits one exercise's fields on an assigned client's plan
export const updateCoachExerciseThunk = createAsyncThunk<
  any,
  { userId: string; exerciseId: string; data: { sets?: string; reps?: string; weight?: string; restSeconds?: number } }
>(
  "coach/updateExercise",
  async ({ userId, exerciseId, data }) =>
    apiRequest("PATCH", `/coach/users/${userId}/exercises/${exerciseId}`, data)
);

// Coach edits one meal's fields on an assigned client's plan
export const updateCoachMealThunk = createAsyncThunk<
  any,
  { userId: string; mealId: string; data: { mealName?: string; mealTime?: string; calories?: number; proteinG?: number; carbsG?: number; fatG?: number; items?: string[] } }
>(
  "coach/updateMeal",
  async ({ userId, mealId, data }) =>
    apiRequest("PATCH", `/coach/users/${userId}/meals/${mealId}`, data)
);

// Coach adds a new meal to an assigned client's plan
export const addCoachMealThunk = createAsyncThunk<
  any,
  { userId: string; data: { mealName: string; mealTime: string; calories: number; proteinG: number; carbsG: number; fatG: number; items: string[]; emoji?: string } }
>(
  "coach/addMeal",
  async ({ userId, data }) => apiRequest("POST", `/coach/users/${userId}/meals`, data)
);

// Coach removes a meal from an assigned client's plan
export const removeCoachMealThunk = createAsyncThunk<
  string,
  { userId: string; mealId: string }
>(
  "coach/removeMeal",
  async ({ userId, mealId }) => {
    await apiRequest("DELETE", `/coach/users/${userId}/meals/${mealId}`);
    return mealId;
  }
);

export const fetchCoachUserProgressThunk = createAsyncThunk<CoachUserProgress, string>(
  "coach/fetchUserProgress",
  async (userId) => apiRequest<CoachUserProgress>("GET", `/coach/users/${userId}/progress`)
);

// Coach earnings + withdrawals
export const fetchEarningsThunk = createAsyncThunk<CoachEarnings, void>(
  "coach/fetchEarnings",
  async () => apiRequest<CoachEarnings>("GET", "/coach/earnings")
);

export const withdrawThunk = createAsyncThunk<void, { amount: number; method: string }>(
  "coach/withdraw",
  async (body, { dispatch }) => {
    await apiRequest("POST", "/coach/withdraw", body);
    dispatch(fetchEarningsThunk());   // refresh balance + history
  }
);

// Coach chat with one client
export const fetchCoachMessagesThunk = createAsyncThunk<CoachMessage[], string>(
  "coach/fetchMessages",
  async (userId) => apiRequest<CoachMessage[]>("GET", `/coach/users/${userId}/messages`)
);

export const sendCoachMessageThunk = createAsyncThunk<CoachMessage, { userId: string; text: string }>(
  "coach/sendMessage",
  async ({ userId, text }) => apiRequest<CoachMessage>("POST", `/coach/users/${userId}/messages`, { text })
);

export const fetchExerciseNotesThunk = createAsyncThunk<
  { userId: string; notes: ExerciseNote[] },
  string
>(
  "coach/fetchExerciseNotes",
  async (userId) => {
    const notes = await apiRequest<ExerciseNote[]>("GET", `/coach/notes/exercises?userId=${userId}`);
    return { userId, notes };
  }
);

export const saveExerciseNoteThunk = createAsyncThunk<
  ExerciseNote,
  { exerciseId: string; userId: string; noteText: string }
>(
  "coach/saveExerciseNote",
  async (data) => apiRequest<ExerciseNote>("POST", "/coach/notes/exercises", data)
);

export const removeExerciseNoteThunk = createAsyncThunk<
  { userId: string; noteId: string },
  { userId: string; noteId: string }
>(
  "coach/removeExerciseNote",
  async ({ userId, noteId }) => {
    await apiRequest("DELETE", `/coach/notes/exercises/${noteId}`);
    return { userId, noteId };
  }
);

export const fetchMealNotesThunk = createAsyncThunk<
  { userId: string; notes: MealNote[] },
  string
>(
  "coach/fetchMealNotes",
  async (userId) => {
    const notes = await apiRequest<MealNote[]>("GET", `/coach/notes/meals?userId=${userId}`);
    return { userId, notes };
  }
);

export const saveMealNoteThunk = createAsyncThunk<
  MealNote,
  { mealId: string; userId: string; noteText: string }
>(
  "coach/saveMealNote",
  async (data) => apiRequest<MealNote>("POST", "/coach/notes/meals", data)
);

export const removeMealNoteThunk = createAsyncThunk<
  { userId: string; noteId: string },
  { userId: string; noteId: string }
>(
  "coach/removeMealNote",
  async ({ userId, noteId }) => {
    await apiRequest("DELETE", `/coach/notes/meals/${noteId}`);
    return { userId, noteId };
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const coachSlice = createSlice({
  name: "coach",
  initialState,
  reducers: {
    setSelectedUser(state, action: PayloadAction<string | null>) {
      state.selectedUserId        = action.payload;
      state.selectedUserWorkout   = null;
      state.selectedUserNutrition = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchCoachMeThunk.fulfilled, (state, action) => {
        state.me       = action.payload;
        state.meLoaded = true;
      })
      .addCase(fetchCoachMeThunk.rejected, (state) => { state.meLoaded = true; });

    builder.addCase(updateCoachProfileThunk.fulfilled, (state, action) => {
      state.me = action.payload;
    });

    builder
      .addCase(fetchCoachUsersThunk.pending, (state) => { state.isLoading = true; })
      .addCase(fetchCoachUsersThunk.fulfilled, (state, action) => {
        state.users     = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchCoachUsersThunk.rejected, (state) => { state.isLoading = false; });

    builder.addCase(fetchCoachUserWorkoutThunk.fulfilled, (state, action) => {
      state.selectedUserWorkout = action.payload;
    });
    builder.addCase(fetchCoachUserNutritionThunk.fulfilled, (state, action) => {
      state.selectedUserNutrition = action.payload;
    });
    builder.addCase(fetchCoachUserProgressThunk.pending, (state) => {
      state.selectedUserProgress = null;
    });
    builder.addCase(fetchCoachUserProgressThunk.fulfilled, (state, action) => {
      state.selectedUserProgress = action.payload;
    });
    builder.addCase(fetchEarningsThunk.fulfilled, (state, action) => {
      state.earnings = action.payload;
    });

    // Replace the edited exercise/meal in the loaded plan so the UI updates instantly
    builder.addCase(updateCoachExerciseThunk.fulfilled, (state, action) => {
      const list = state.selectedUserWorkout?.exercises;
      if (Array.isArray(list)) {
        const idx = list.findIndex((e: any) => e.id === action.payload.id);
        if (idx !== -1) list[idx] = action.payload;
      }
    });
    builder.addCase(updateCoachMealThunk.fulfilled, (state, action) => {
      const list = state.selectedUserNutrition?.meals;
      if (Array.isArray(list)) {
        const idx = list.findIndex((m: any) => m.id === action.payload.id);
        if (idx !== -1) list[idx] = action.payload;
      }
    });
    builder.addCase(addCoachMealThunk.fulfilled, (state, action) => {
      if (state.selectedUserNutrition?.meals) {
        state.selectedUserNutrition.meals.push(action.payload);
      }
    });
    builder.addCase(removeCoachMealThunk.fulfilled, (state, action) => {
      const list = state.selectedUserNutrition?.meals;
      if (Array.isArray(list)) {
        state.selectedUserNutrition.meals = list.filter((m: any) => m.id !== action.payload);
      }
    });

    // Coach chat thread
    builder.addCase(fetchCoachMessagesThunk.fulfilled, (state, action) => {
      state.selectedUserMessages = action.payload;
      // Opening the thread clears this client's unread badge
      const u = state.users.find((x) => x.id === action.meta.arg);
      if (u) u.unreadMessages = 0;
    });
    builder.addCase(sendCoachMessageThunk.fulfilled, (state, action) => {
      state.selectedUserMessages.push(action.payload);
    });

    // Exercise notes
    builder.addCase(fetchExerciseNotesThunk.fulfilled, (state, action) => {
      state.exerciseNotes[action.payload.userId] = action.payload.notes;
    });
    builder.addCase(saveExerciseNoteThunk.fulfilled, (state, action) => {
      const note = action.payload;
      const list = state.exerciseNotes[note.userId] || [];
      const idx  = list.findIndex((n) => n.id === note.id);
      if (idx !== -1) list[idx] = note;
      else list.push(note);
      state.exerciseNotes[note.userId] = list;
    });
    builder.addCase(removeExerciseNoteThunk.fulfilled, (state, action) => {
      const list = state.exerciseNotes[action.payload.userId];
      if (list) {
        state.exerciseNotes[action.payload.userId] = list.filter((n) => n.id !== action.payload.noteId);
      }
    });

    // Meal notes
    builder.addCase(fetchMealNotesThunk.fulfilled, (state, action) => {
      state.mealNotes[action.payload.userId] = action.payload.notes;
    });
    builder.addCase(saveMealNoteThunk.fulfilled, (state, action) => {
      const note = action.payload;
      const list = state.mealNotes[note.userId] || [];
      const idx  = list.findIndex((n) => n.id === note.id);
      if (idx !== -1) list[idx] = note;
      else list.push(note);
      state.mealNotes[note.userId] = list;
    });
    builder.addCase(removeMealNoteThunk.fulfilled, (state, action) => {
      const list = state.mealNotes[action.payload.userId];
      if (list) {
        state.mealNotes[action.payload.userId] = list.filter((n) => n.id !== action.payload.noteId);
      }
    });
  },
});

export const { setSelectedUser } = coachSlice.actions;
export default coachSlice.reducer;
