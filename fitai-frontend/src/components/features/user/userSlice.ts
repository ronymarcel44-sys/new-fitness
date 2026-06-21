// src/features/user/userSlice.ts
//
// Changes from Phase 2:
// - Added fetchProfileThunk: GET /users/me — loads profile from DB on app start
// - Added saveProfileThunk:  PUT /users/me — saves profile to DB after AI generates it
// - Existing setProfile, completeSetup, resetProfile are kept because
//   ChatPage still dispatches them synchronously when it parses the AI response.
//   saveProfileThunk is dispatched right after to persist the data.

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { apiRequest } from "@/lib/api";
import type { UserProfile, GoalKey, AssignedCoach } from "@/types";

// Shape of what the backend returns from GET/PUT /users/me
// Numbers come back as numbers from the DB, but UserProfile stores strings —
// we convert them in the thunk before dispatching to the slice
interface BackendProfile {
  id:          string;
  name:        string;
  email:       string;
  role:        string;
  plan:        string;
  hasSetup:    boolean;
  age:         number | null;
  height:      number | null;
  weight:      number | null;
  fitnessLevel:string | null;
  goal:        string | null;
  diseases:    string | null;
  chest:       number | null;
  waist:       number | null;
  hips:        number | null;
  arms:        number | null;
  legs:        number | null;
}

interface UserState {
  profile:         UserProfile;
  coach:           AssignedCoach | null;   // the human coach assigned to this user (premium)
  availableCoaches: AssignedCoach[];       // active coaches a premium user can pick from
  coachExerciseNotes: Record<string, string>; // exerciseId → coach note text
  coachMealNotes:     Record<string, string>; // mealId → coach note text
}

const initialState: UserState = {
  profile: {
    name: "", age: "", weight: "", height: "",
    goal: "", level: "", diseases: "",
    hasCompletedSetup: false,
    plan: "free",
  },
  coach:            null,
  availableCoaches: [],
  coachExerciseNotes: {},
  coachMealNotes:     {},
};

// Converts a backend profile (numbers) to the frontend UserProfile shape (strings)
// This keeps the rest of the app working exactly as before
function backendToFrontend(data: BackendProfile): Partial<UserProfile> {
  return {
    name:              data.name,
    age:               data.age?.toString()          ?? "",
    weight:            data.weight?.toString()        ?? "",
    height:            data.height?.toString()        ?? "",
    goal:              (data.goal as GoalKey | null)  ?? "",
    level:             data.fitnessLevel              ?? "",
    diseases:          data.diseases                  ?? "",
    chest:             data.chest?.toString()         ?? "",
    waist:             data.waist?.toString()         ?? "",
    hips:              data.hips?.toString()          ?? "",
    arms:              data.arms?.toString()          ?? "",
    legs:              data.legs?.toString()          ?? "",
    hasCompletedSetup: data.hasSetup,
    plan:              (data.plan as "free" | "premium") ?? "free",
  };
}

// ── Async Thunks ──────────────────────────────────────────────────────────────

// Fetch profile from DB — called once on app load when the user is already logged in.
// This ensures a page refresh doesn't lose the profile data.
export const fetchProfileThunk = createAsyncThunk<
  Partial<UserProfile>,  // what it returns on success
  void,                  // no arguments needed
  { rejectValue: string }
>(
  "user/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest<BackendProfile>("GET", "/users/me");
      return backendToFrontend(data);
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : "Failed to load profile");
    }
  }
);

// Save profile to DB — called after the AI generates a plan in ChatPage.
// ChatPage still calls setProfile (sync) for instant UI update,
// then dispatches saveProfileThunk to persist it to the backend.
export const saveProfileThunk = createAsyncThunk<
  Partial<UserProfile>,
  Partial<UserProfile>,   // the profile data to save
  { rejectValue: string }
>(
  "user/saveProfile",
  async (profileData, { rejectWithValue }) => {
    try {
      // Convert frontend string values to the numbers the backend expects
      const body = {
        name:        profileData.name,
        age:         profileData.age    ? Number(profileData.age)    : undefined,
        weight:      profileData.weight ? Number(profileData.weight) : undefined,
        height:      profileData.height ? Number(profileData.height) : undefined,
        fitnessLevel:profileData.level,
        goal:        profileData.goal,
        diseases:    profileData.diseases,
        chest:       profileData.chest  ? Number(profileData.chest)  : undefined,
        waist:       profileData.waist  ? Number(profileData.waist)  : undefined,
        hips:        profileData.hips   ? Number(profileData.hips)   : undefined,
        arms:        profileData.arms   ? Number(profileData.arms)   : undefined,
        legs:        profileData.legs   ? Number(profileData.legs)   : undefined,
        hasSetup:    profileData.hasCompletedSetup,
      };
      const data = await apiRequest<BackendProfile>("PUT", "/users/me", body);
      return backendToFrontend(data);
    } catch (err) {
      // Log the error but don't block the UI — the local Redux state is already updated
      console.error("Failed to save profile to backend:", err);
      return rejectWithValue(err instanceof Error ? err.message : "Failed to save profile");
    }
  }
);

// Fetch the coach assigned to this user (null if none). Called on app start.
export const fetchCoachThunk = createAsyncThunk<AssignedCoach | null, void>(
  "user/fetchCoach",
  async () => apiRequest<AssignedCoach | null>("GET", "/users/me/coach")
);

// Fetch the list of active coaches a premium user can choose from.
export const fetchAvailableCoachesThunk = createAsyncThunk<AssignedCoach[], void>(
  "user/fetchAvailableCoaches",
  async () => apiRequest<AssignedCoach[]>("GET", "/users/coaches")
);

// Premium user picks their coach → returns the assigned coach.
export const chooseCoachThunk = createAsyncThunk<AssignedCoach, string>(
  "user/chooseCoach",
  async (coachId) => apiRequest<AssignedCoach>("POST", "/users/me/coach", { coachId })
);

// Premium user removes their assigned coach.
export const removeCoachThunk = createAsyncThunk<void, void>(
  "user/removeCoach",
  async () => { await apiRequest("DELETE", "/users/me/coach"); }
);

// Fetch all notes the user's coach left on their exercises/meals.
export const fetchCoachNotesThunk = createAsyncThunk<
  { exerciseNotes: { exerciseId: string; noteText: string }[]; mealNotes: { mealId: string; noteText: string }[] },
  void
>(
  "user/fetchCoachNotes",
  async () => apiRequest("GET", "/users/me/coach-notes")
);

// After returning from Stripe Checkout, verify the session and upgrade the plan.
export const confirmPaymentThunk = createAsyncThunk<
  { plan: "premium" },
  string,
  { rejectValue: string }
>(
  "user/confirmPayment",
  async (sessionId, { rejectWithValue }) => {
    try {
      return await apiRequest<{ plan: "premium" }>(
        "GET", `/payment/confirm?session_id=${encodeURIComponent(sessionId)}`
      );
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : "Failed to confirm payment");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    // Synchronous profile update — still used by ChatPage for instant UI feedback
    setProfile(state, action: PayloadAction<Partial<UserProfile>>) {
      state.profile = { ...state.profile, ...action.payload };
    },

    // Mark setup as complete — called after AI finishes onboarding
    completeSetup(state) {
      state.profile.hasCompletedSetup = true;
    },

    // Clear profile on logout
    resetProfile(state) {
      state.profile            = initialState.profile;
      state.coach              = null;
      state.availableCoaches   = [];
      state.coachExerciseNotes = {};
      state.coachMealNotes     = {};
    },
  },

  extraReducers: (builder) => {
    // When fetchProfileThunk succeeds, merge the DB data into the local profile
    builder.addCase(fetchProfileThunk.fulfilled, (state, action) => {
      state.profile = { ...state.profile, ...action.payload };
    });

    // When saveProfileThunk succeeds, update local state with what the DB confirmed
    builder.addCase(saveProfileThunk.fulfilled, (state, action) => {
      state.profile = { ...state.profile, ...action.payload };
    });

    // Coach assigned to this user (or null)
    builder.addCase(fetchCoachThunk.fulfilled, (state, action) => {
      state.coach = action.payload;
    });

    // List of coaches the user can pick from
    builder.addCase(fetchAvailableCoachesThunk.fulfilled, (state, action) => {
      state.availableCoaches = action.payload;
    });

    // User picked a coach — store it
    builder.addCase(chooseCoachThunk.fulfilled, (state, action) => {
      state.coach = action.payload;
    });

    // User removed their coach
    builder.addCase(removeCoachThunk.fulfilled, (state) => {
      state.coach = null;
    });

    // Payment confirmed — flip the plan to premium
    builder.addCase(confirmPaymentThunk.fulfilled, (state, action) => {
      state.profile.plan = action.payload.plan;
    });

    // Coach notes — build lookup maps keyed by exerciseId / mealId
    builder.addCase(fetchCoachNotesThunk.fulfilled, (state, action) => {
      state.coachExerciseNotes = Object.fromEntries(
        action.payload.exerciseNotes.map((n) => [n.exerciseId, n.noteText])
      );
      state.coachMealNotes = Object.fromEntries(
        action.payload.mealNotes.map((n) => [n.mealId, n.noteText])
      );
    });

    // The profile/save thunks silently ignore failures — the local state is
    // already correct and the user doesn't need to know about background errors
  },
});

export const { setProfile, completeSetup, resetProfile } = userSlice.actions;
export default userSlice.reducer;