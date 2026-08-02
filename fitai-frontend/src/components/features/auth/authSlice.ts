// src/features/auth/authSlice.ts
//
// Changes from Phase 2:
// - login and register are now async thunks (they call the real backend)
// - accessToken and refreshToken are stored in state (persisted by store.ts)
// - isLoading is added for showing a spinner while the request is in-flight
// - FAKE_USERS is no longer used here

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { apiRequest } from "@/lib/api";
import type { UserRole } from "@/types";

// Shape of the user object returned from the backend on login/register
interface AuthUser {
  id:    string;
  name:  string;
  email: string;
  role:  UserRole;
}

// Shape of the full response from POST /auth/login and POST /auth/register
interface AuthResponse {
  user:         AuthUser;
  accessToken:  string;
  refreshToken: string;
}

interface AuthState {
  isLoggedIn:   boolean;
  displayName:  string;
  email:        string;       // replaces username — backend uses email
  role:         UserRole;
  accessToken:  string;       // short-lived JWT, sent with every API request
  refreshToken: string;       // long-lived JWT, used to renew the access token
  isLoading:    boolean;      // true while login/register request is in-flight
  error:        string;
}

const initialState: AuthState = {
  isLoggedIn:   false,
  displayName:  "",
  email:        "",
  role:         "user",
  accessToken:  "",
  refreshToken: "",
  isLoading:    false,
  error:        "",
};

// ── Async Thunks ──────────────────────────────────────────────────────────────

// Login thunk — calls POST /auth/login
// The component dispatches this instead of the old synchronous login action
export const loginThunk = createAsyncThunk<
  AuthResponse,                                     // what it returns on success
  { email: string; password: string },              // what the caller passes in
  { rejectValue: string }                           // shape of the error value
>(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      return await apiRequest<AuthResponse>("POST", "/auth/login", credentials);
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : "Login failed");
    }
  }
);

// Register thunk — calls POST /auth/register
export const registerThunk = createAsyncThunk<
  AuthResponse,
  { name: string; email: string; password: string },
  { rejectValue: string }
>(
  "auth/register",
  async (data, { rejectWithValue }) => {
    try {
      return await apiRequest<AuthResponse>("POST", "/auth/register", data);
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : "Registration failed");
    }
  }
);

// Coach self-registration thunk — calls POST /auth/register-coach.
// On success the coach is logged in (role "coach") with status "pending".
export const registerCoachThunk = createAsyncThunk<
  AuthResponse,
  {
    name: string; email: string; password: string; specialty: string;
    bio: string; yearsExperience: string;
    certifications: { type: string; number: string; typeOther?: string }[];
  },
  { rejectValue: string }
>(
  "auth/registerCoach",
  async (data, { rejectWithValue }) => {
    try {
      return await apiRequest<AuthResponse>("POST", "/auth/register-coach", data);
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : "Registration failed");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Synchronous logout — clears everything from state
    logout(state) {
      state.isLoggedIn   = false;
      state.displayName  = "";
      state.email        = "";
      state.role         = "user";
      state.accessToken  = "";
      state.refreshToken = "";
      state.error        = "";
      state.isLoading    = false;
    },

    // Clear just the error message — called when the login page unmounts
    clearError(state) {
      state.error = "";
    },

    // Update only the access token after a successful refresh
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
  },

  // Handle the async thunk lifecycle (pending → fulfilled → rejected)
  extraReducers: (builder) => {
    // ── loginThunk ────────────────────────────────────────────────────────────
    builder
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.error     = "";
      })
      .addCase(loginThunk.fulfilled, (state, action: PayloadAction<AuthResponse>) => {
        state.isLoading    = false;
        state.isLoggedIn   = true;
        state.displayName  = action.payload.user.name;
        state.email        = action.payload.user.email;
        state.role         = action.payload.user.role as UserRole;
        state.accessToken  = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.error        = "";
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error     = action.payload ?? "حدث خطأ أثناء تسجيل الدخول";
      });

    // ── registerThunk ─────────────────────────────────────────────────────────
    builder
      .addCase(registerThunk.pending, (state) => {
        state.isLoading = true;
        state.error     = "";
      })
      .addCase(registerThunk.fulfilled, (state, action: PayloadAction<AuthResponse>) => {
        state.isLoading    = false;
        state.isLoggedIn   = true;
        state.displayName  = action.payload.user.name;
        state.email        = action.payload.user.email;
        state.role         = action.payload.user.role as UserRole;
        state.accessToken  = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.error        = "";
      })
      .addCase(registerThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error     = action.payload ?? "حدث خطأ أثناء إنشاء الحساب";
      });

    // ── registerCoachThunk ────────────────────────────────────────────────────
    builder
      .addCase(registerCoachThunk.pending, (state) => {
        state.isLoading = true;
        state.error     = "";
      })
      .addCase(registerCoachThunk.fulfilled, (state, action: PayloadAction<AuthResponse>) => {
        state.isLoading    = false;
        state.isLoggedIn   = true;
        state.displayName  = action.payload.user.name;
        state.email        = action.payload.user.email;
        state.role         = action.payload.user.role as UserRole;
        state.accessToken  = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.error        = "";
      })
      .addCase(registerCoachThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error     = action.payload ?? "حدث خطأ أثناء إنشاء حساب المدرب";
      });
  },
});

export const { logout, clearError, setAccessToken } = authSlice.actions;
export default authSlice.reducer;