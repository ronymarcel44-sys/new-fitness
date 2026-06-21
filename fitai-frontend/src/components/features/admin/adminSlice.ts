// src/features/admin/adminSlice.ts
//
// Changes from Phase 2:
// - All mock data removed (initial state is now empty arrays)
// - fetchAdminDataThunk loads users, coaches, exercises, stats, settings from DB
// - All mutation actions now also call backend thunks to persist changes
// - Existing synchronous reducers kept for instant UI feedback

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { apiRequest } from "@/lib/api";
import type { AdminUser, AdminStats, AISettings, Coach, AdminExercise } from "@/types";

interface AdminState {
  users:          AdminUser[];
  coaches:        Coach[];
  exercises:      AdminExercise[];
  stats:          AdminStats;
  aiSettings:     AISettings;
  selectedUserId: string | null;
  isLoading:      boolean;
}

const initialState: AdminState = {
  users:          [],
  coaches:        [],
  exercises:      [],
  stats: {
    totalUsers: 0, activeToday: 0, premiumUsers: 0,
    totalPlansGenerated: 0, aiCallsToday: 0, aiCallsThisMonth: 0,
  },
  aiSettings: {
    model:        "llama-3.3-70b-versatile",
    maxTokens:    4000,
    temperature:  0.7,
    systemPrompt: "",
  },
  selectedUserId: null,
  isLoading:      false,
};

// ── Async Thunks ──────────────────────────────────────────────────────────────

// Fetch all admin data in parallel on admin panel load
export const fetchAdminDataThunk = createAsyncThunk(
  "admin/fetchAll",
  async () => {
    const [users, coaches, exercises, stats, aiSettings] = await Promise.all([
      apiRequest<AdminUser[]>("GET",      "/admin/users"),
      apiRequest<Coach[]>("GET",          "/admin/coaches"),
      apiRequest<AdminExercise[]>("GET",  "/admin/exercises"),
      apiRequest<AdminStats>("GET",       "/admin/stats"),
      apiRequest<AISettings>("GET",       "/admin/settings"),
    ]);
    return { users, coaches, exercises, stats, aiSettings };
  }
);

// User management
export const updateUserStatusThunk = createAsyncThunk(
  "admin/updateUserStatus",
  async ({ id, status }: { id: string; status: AdminUser["status"] }) => {
    await apiRequest("PATCH", `/admin/users/${id}/status`, { status });
    return { id, status };
  }
);

export const updateUserPlanThunk = createAsyncThunk(
  "admin/updateUserPlan",
  async ({ id, plan }: { id: string; plan: AdminUser["plan"] }) => {
    await apiRequest("PATCH", `/admin/users/${id}/plan`, { plan });
    return { id, plan };
  }
);

export const assignCoachThunk = createAsyncThunk(
  "admin/assignCoach",
  async ({ userId, coachId }: { userId: string; coachId: string }) => {
    await apiRequest("PATCH", `/admin/users/${userId}/coach`, { coachId: coachId || null });
    return { userId, coachId };
  }
);

export const deleteUserThunk = createAsyncThunk(
  "admin/deleteUser",
  async (userId: string) => {
    await apiRequest("DELETE", `/admin/users/${userId}`);
    return userId;
  }
);

// Coach management
export const addCoachThunk = createAsyncThunk(
  "admin/addCoach",
  async (data: Omit<Coach, "id" | "assignedUsers">) => {
    return await apiRequest<Coach>("POST", "/admin/coaches", data);
  }
);

export const updateCoachStatusThunk = createAsyncThunk(
  "admin/updateCoachStatus",
  async ({ id, status }: { id: string; status: Coach["status"] }) => {
    await apiRequest("PATCH", `/admin/coaches/${id}/status`, { status });
    return { id, status };
  }
);

// Exercise library
export const addExerciseThunk = createAsyncThunk(
  "admin/addExercise",
  async (data: Omit<AdminExercise, "id">) => {
    return await apiRequest<AdminExercise>("POST", "/admin/exercises", data);
  }
);

export const updateExerciseThunk = createAsyncThunk(
  "admin/updateExercise",
  async (exercise: AdminExercise) => {
    return await apiRequest<AdminExercise>("PUT", `/admin/exercises/${exercise.id}`, exercise);
  }
);

export const deleteExerciseThunk = createAsyncThunk(
  "admin/deleteExercise",
  async (id: string) => {
    await apiRequest("DELETE", `/admin/exercises/${id}`);
    return id;
  }
);

// AI Settings
export const updateAISettingsThunk = createAsyncThunk(
  "admin/updateAISettings",
  async (settings: Partial<AISettings>) => {
    return await apiRequest<AISettings>("PUT", "/admin/settings", settings);
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    setSelectedUser(state, action: PayloadAction<string | null>) {
      state.selectedUserId = action.payload;
    },

    // Kept for backward compatibility — existing admin pages dispatch these
    // They're now wrappers that do the sync local update only;
    // pages should also dispatch the corresponding thunk to persist to DB.
    updateUserStatus(state, action: PayloadAction<{ id: string; status: AdminUser["status"] }>) {
      const user = state.users.find((u) => u.id === action.payload.id);
      if (user) user.status = action.payload.status;
    },
    updateUserPlan(state, action: PayloadAction<{ id: string; plan: AdminUser["plan"] }>) {
      const user = state.users.find((u) => u.id === action.payload.id);
      if (user) user.plan = action.payload.plan;
    },
    assignCoach(state, action: PayloadAction<{ userId: string; coachId: string }>) {
      const user = state.users.find((u) => u.id === action.payload.userId);
      if (user) user.coachId = action.payload.coachId;
      state.coaches.forEach((c) => {
        c.assignedUsers = c.assignedUsers.filter((id) => id !== action.payload.userId);
      });
      const coach = state.coaches.find((c) => c.id === action.payload.coachId);
      if (coach && !coach.assignedUsers.includes(action.payload.userId)) {
        coach.assignedUsers.push(action.payload.userId);
      }
    },
    deleteUser(state, action: PayloadAction<string>) {
      state.users = state.users.filter((u) => u.id !== action.payload);
    },
    updateCoachStatus(state, action: PayloadAction<{ id: string; status: Coach["status"] }>) {
      const coach = state.coaches.find((c) => c.id === action.payload.id);
      if (coach) coach.status = action.payload.status;
    },
    addCoach(state, action: PayloadAction<Omit<Coach, "id" | "assignedUsers">>) {
      state.coaches.push({ ...action.payload, id: `c${Date.now()}`, assignedUsers: [] });
    },
    addExercise(state, action: PayloadAction<Omit<AdminExercise, "id">>) {
      state.exercises.push({ ...action.payload, id: `ex${Date.now()}` });
    },
    updateExercise(state, action: PayloadAction<AdminExercise>) {
      const idx = state.exercises.findIndex((e) => e.id === action.payload.id);
      if (idx !== -1) state.exercises[idx] = action.payload;
    },
    deleteExercise(state, action: PayloadAction<string>) {
      state.exercises = state.exercises.filter((e) => e.id !== action.payload);
    },
    updateAISettings(state, action: PayloadAction<Partial<AISettings>>) {
      state.aiSettings = { ...state.aiSettings, ...action.payload };
    },
  },

  extraReducers: (builder) => {
    // fetchAdminDataThunk — populate everything from the DB
    builder
      .addCase(fetchAdminDataThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchAdminDataThunk.fulfilled, (state, action) => {
        state.users      = action.payload.users;
        state.coaches    = action.payload.coaches;
        state.exercises  = action.payload.exercises;
        state.stats      = action.payload.stats;
        state.aiSettings = action.payload.aiSettings;
        state.isLoading  = false;
      })
      .addCase(fetchAdminDataThunk.rejected, (state) => {
        state.isLoading = false;
      });

    // Thunks that mutate — update local state from their fulfilled payload
    builder.addCase(updateUserStatusThunk.fulfilled, (state, action) => {
      const u = state.users.find((x) => x.id === action.payload.id);
      if (u) u.status = action.payload.status;
    });
    builder.addCase(updateUserPlanThunk.fulfilled, (state, action) => {
      const u = state.users.find((x) => x.id === action.payload.id);
      if (u) u.plan = action.payload.plan;
    });
    builder.addCase(assignCoachThunk.fulfilled, (state, action) => {
      const u = state.users.find((x) => x.id === action.payload.userId);
      if (u) u.coachId = action.payload.coachId;
      state.coaches.forEach((c) => {
        c.assignedUsers = c.assignedUsers.filter((id) => id !== action.payload.userId);
      });
      const c = state.coaches.find((x) => x.id === action.payload.coachId);
      if (c && !c.assignedUsers.includes(action.payload.userId)) {
        c.assignedUsers.push(action.payload.userId);
      }
    });
    builder.addCase(deleteUserThunk.fulfilled, (state, action) => {
      state.users = state.users.filter((u) => u.id !== action.payload);
    });
    builder.addCase(addCoachThunk.fulfilled, (state, action) => {
      state.coaches.push({ ...action.payload, assignedUsers: [] });
    });
    builder.addCase(updateCoachStatusThunk.fulfilled, (state, action) => {
      const c = state.coaches.find((x) => x.id === action.payload.id);
      if (c) c.status = action.payload.status;
    });
    builder.addCase(addExerciseThunk.fulfilled, (state, action) => {
      state.exercises.push(action.payload);
    });
    builder.addCase(updateExerciseThunk.fulfilled, (state, action) => {
      const idx = state.exercises.findIndex((e) => e.id === action.payload.id);
      if (idx !== -1) state.exercises[idx] = action.payload;
    });
    builder.addCase(deleteExerciseThunk.fulfilled, (state, action) => {
      state.exercises = state.exercises.filter((e) => e.id !== action.payload);
    });
    builder.addCase(updateAISettingsThunk.fulfilled, (state, action) => {
      state.aiSettings = action.payload;
    });
  },
});

export const {
  setSelectedUser,
  updateUserStatus, updateUserPlan, assignCoach, deleteUser,
  updateCoachStatus, addCoach,
  addExercise, updateExercise, deleteExercise,
  updateAISettings,
} = adminSlice.actions;

export default adminSlice.reducer;
