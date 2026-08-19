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
  status:      string;
  hasSetup:    boolean;
  age:         number | null;
  height:      number | null;
  weight:      number | null;
  fitnessLevel:string | null;
  goal:        string | null;
  diseases:    string | null;
  gender:      string | null; // NEW (Task 3)
  chest:       number | null;
  waist:       number | null;
  hips:        number | null;
  arms:        number | null;
  legs:        number | null;
  neck:        number | null;
  targetWeight:number | null; // legacy, unrelated feature — see schema comment
  // Single target per metric (goal redesign) — no more mini/main tiers.
  targetLeanMass:       number | null; // no "main" counterpart needed, name is already unambiguous
  goalConfirmedByAI:    boolean;
  mainTargetWeight:         number | null;
  mainTargetBodyFatPct:     number | null;
  mainTargetWaist:          number | null; // NEW (goal redesign)
  mainTargetHips:           number | null; // NEW (goal redesign)
  mainTargetNeck:           number | null; // NEW (goal redesign)
  mainTargetBenchPress:     number | null;
  mainTargetSquat:          number | null;
  mainTargetDeadlift:       number | null;
  mainTargetOverheadPress:  number | null; // NEW (goal redesign)
  startWeight: number | null;
  startChest:  number | null;
  startWaist:  number | null;
  startHips:   number | null;
  startArms:   number | null;
  startLegs:   number | null;
  startNeck:   number | null; // NEW (goal redesign)
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
    gender:            (data.gender as "male" | "female" | null) ?? "", // NEW (Task 3)
    chest:             data.chest?.toString()         ?? "",
    waist:             data.waist?.toString()         ?? "",
    hips:              data.hips?.toString()          ?? "",
    arms:              data.arms?.toString()          ?? "",
    legs:              data.legs?.toString()          ?? "",
    neck:              data.neck?.toString()          ?? "",
    targetWeight:      data.targetWeight?.toString()  ?? "",
    // Single target per metric (goal redesign) — no more mini/main tiers.
    targetLeanMass:       data.targetLeanMass?.toString()       ?? "",
    goalConfirmedByAI:    data.goalConfirmedByAI ?? false,
    mainTargetWeight:         data.mainTargetWeight?.toString()         ?? "",
    mainTargetBodyFatPct:     data.mainTargetBodyFatPct?.toString()     ?? "",
    mainTargetWaist:          data.mainTargetWaist?.toString()          ?? "",
    mainTargetHips:           data.mainTargetHips?.toString()           ?? "",
    mainTargetNeck:           data.mainTargetNeck?.toString()           ?? "",
    mainTargetBenchPress:     data.mainTargetBenchPress?.toString()     ?? "",
    mainTargetSquat:          data.mainTargetSquat?.toString()          ?? "",
    mainTargetDeadlift:       data.mainTargetDeadlift?.toString()       ?? "",
    mainTargetOverheadPress:  data.mainTargetOverheadPress?.toString()  ?? "",
    startWeight:       data.startWeight?.toString()   ?? "",
    startChest:        data.startChest?.toString()    ?? "",
    startWaist:        data.startWaist?.toString()    ?? "",
    startHips:         data.startHips?.toString()     ?? "",
    startArms:         data.startArms?.toString()     ?? "",
    startLegs:         data.startLegs?.toString()     ?? "",
    startNeck:         data.startNeck?.toString()     ?? "",
    hasCompletedSetup: data.hasSetup,
    plan:              (data.plan as "free" | "premium") ?? "free",
    status:            data.status ?? "active",
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

// Coerce a possibly messy numeric string (e.g. the AI writing "95 سم" instead
// of "95", despite being told not to) into a clean number, or undefined if
// it's empty/not actually numeric. Without this, Number("95 سم") -> NaN ->
// JSON.stringify(NaN) -> null -> silently WIPES the field in the DB instead
// of just failing loudly. This was the root cause of measurements not saving.
function numOrUndefined(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const cleaned = String(v).replace(/[^\d.]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

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
        age:         numOrUndefined(profileData.age),
        weight:      numOrUndefined(profileData.weight),
        height:      numOrUndefined(profileData.height),
        fitnessLevel:profileData.level,
        goal:        profileData.goal,
        diseases:    profileData.diseases,
        gender:      profileData.gender, // NEW (Task 3)
        chest:       numOrUndefined(profileData.chest),
        waist:       numOrUndefined(profileData.waist),
        hips:        numOrUndefined(profileData.hips),
        arms:        numOrUndefined(profileData.arms),
        legs:        numOrUndefined(profileData.legs),
        neck:        numOrUndefined(profileData.neck),
        // Pass the raw value: "75" → 75, "" → clears to null (revert to auto),
        // undefined → omitted so other saves never wipe an existing target.
        targetWeight:profileData.targetWeight,
        // Single target per metric (goal redesign) — ChatPage only ever
        // includes these when the AI's confirmedGoal block set them, so a
        // plain truthy-check + Number() is enough (no "clear to null" use
        // case here, unlike targetWeight). targetLeanMass has no "main"
        // counterpart — it's auto-calculated server-side either way, never
        // sent directly by the AI, but still passed through here for the
        // rare manual-override path (see user.routes.ts).
        targetLeanMass:       numOrUndefined(profileData.targetLeanMass),
        goalConfirmedByAI:    profileData.goalConfirmedByAI,
        mainTargetWeight:         numOrUndefined(profileData.mainTargetWeight),
        mainTargetBodyFatPct:     numOrUndefined(profileData.mainTargetBodyFatPct),
        mainTargetWaist:          numOrUndefined(profileData.mainTargetWaist),
        mainTargetHips:           numOrUndefined(profileData.mainTargetHips),
        mainTargetNeck:           numOrUndefined(profileData.mainTargetNeck),
        mainTargetBenchPress:     numOrUndefined(profileData.mainTargetBenchPress),
        mainTargetSquat:          numOrUndefined(profileData.mainTargetSquat),
        mainTargetDeadlift:       numOrUndefined(profileData.mainTargetDeadlift),
        mainTargetOverheadPress:  numOrUndefined(profileData.mainTargetOverheadPress),
        startBench:         numOrUndefined(profileData.startBench),         // NEW (Phase 2) — lift baselines
        startSquat:         numOrUndefined(profileData.startSquat),
        startDeadlift:      numOrUndefined(profileData.startDeadlift),
        startOverheadPress: numOrUndefined(profileData.startOverheadPress),
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