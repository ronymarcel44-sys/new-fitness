// src/App.tsx
//
// Changes from Step 6:
// - Added fetchNutritionThunk + fetchMealLogsThunk (Step 7)
// - Added fetchProgressThunk + fetchChatThunk (Step 8)

import { useEffect }                              from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAppSelector, useAppDispatch }          from "@/app/hooks";
import { fetchProfileThunk, fetchCoachThunk, fetchCoachNotesThunk } from "@/features/user/userSlice";
import { fetchWorkoutThunk }                       from "@/features/workout/workoutSlice";
import { fetchNutritionThunk, fetchMealLogsThunk } from "@/features/nutrition/nutritionSlice";
import { fetchProgressThunk, fetchActivityThunk, fetchGoalSummaryThunk }  from "@/features/progress/progressSlice";
import { fetchChatThunk }                          from "@/features/chat/chatSlice";
import { Navbar }                                  from "@/components/layout/Navbar";
import { BannedScreen }                            from "@/components/BannedScreen";
import { CoachChatBubble }                          from "@/components/chat/CoachChatBubble";
import { CelebrationToast }                          from "@/components/goal/CelebrationToast";

// User Pages
import { LandingPage }        from "@/pages/LandingPage";
import { LoginPage }          from "@/pages/LoginPage";
import { RegisterPage }       from "@/pages/RegisterPage";
import { CoachRegisterPage }  from "@/pages/CoachRegisterPage";
import { DashboardPage }      from "@/pages/DashboardPage";
import { WorkoutPage }        from "@/pages/WorkoutPage";
import { NutritionPage }      from "@/pages/NutritionPage";
import { ChatPage }           from "@/pages/ChatPage";
import { ProgressPage }       from "@/pages/ProgressPage";
import { WeeklyPlanPage }     from "@/pages/WeeklyPlanPage";
import { ExerciseDetailPage } from "@/pages/ExerciseDetailPage";
import { GoalDetailsPage }    from "@/pages/GoalDetailsPage"; // NEW (goal redesign)
import { PremiumPage }        from "@/pages/PremiumPage";
import { ProfilePage }        from "@/pages/ProfilePage";

// Admin Pages
import { AdminLayout }        from "@/pages/admin/AdminLayout";
import { AdminDashboard }     from "@/pages/admin/AdminDashboard";
import { AdminUsers }         from "@/pages/admin/AdminUsers";
import { AdminUserDetail }    from "@/pages/admin/AdminUserDetail";
import { AdminCoaches }       from "@/pages/admin/AdminCoaches";
import { AdminSubscriptions } from "@/pages/admin/AdminSubscriptions";
import { AdminProfit }        from "@/pages/admin/AdminProfit";

// Coach Pages
import { CoachLayout }        from "@/pages/coach/CoachLayout";
import { CoachDashboard }     from "@/pages/coach/CoachDashboard";
import { CoachUserWorkout }   from "@/pages/coach/CoachUserWorkout";
import { CoachUserNutrition } from "@/pages/coach/CoachUserNutrition";
import { CoachChat }          from "@/pages/coach/CoachChat";
import { CoachUserProgress }  from "@/pages/coach/CoachUserProgress";
import { CoachProfile }       from "@/pages/coach/CoachProfile";
import { CoachEarnings }      from "@/pages/coach/CoachEarnings";

// ── Route Guards ──────────────────────────────────────────────────────────────

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAppSelector((s) => s.auth);
  return isLoggedIn ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, role } = useAppSelector((s) => s.auth);
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function CoachRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, role } = useAppSelector((s) => s.auth);
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (role !== "coach") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  // A banned user (status "disabled") can still log in, but every screen is
  // replaced by the ban notice until an admin lifts it.
  const status = useAppSelector((s) => s.user.profile.status);
  if (status === "disabled") return <BannedScreen />;

  return (
    <div className="min-h-screen bg-bg font-tajawal text-slate-100">
      <Navbar />
      {children}
      <CoachChatBubble />
      <CelebrationToast />
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const dispatch             = useAppDispatch();
  const { isLoggedIn, role } = useAppSelector((s) => s.auth);

  // Fetch all user data from DB on app load
  useEffect(() => {
    if (isLoggedIn && role === "user") {
      dispatch(fetchProfileThunk());    // Step 5
      dispatch(fetchCoachThunk());      // assigned human coach (premium)
      dispatch(fetchCoachNotesThunk()); // coach feedback on exercises/meals
      dispatch(fetchWorkoutThunk());    // Step 6
      dispatch(fetchNutritionThunk());  // Step 7
      dispatch(fetchMealLogsThunk());   // Step 7
      dispatch(fetchProgressThunk());   // Step 8
      dispatch(fetchActivityThunk());   // commitment streak (persisted server-side)
      dispatch(fetchGoalSummaryThunk());// NEW (Task 6) — real progress vs confirmed goal targets
      dispatch(fetchChatThunk());       // Step 8
    }
  }, [isLoggedIn, role, dispatch]);

  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route path="/"         element={<div className="min-h-screen bg-bg font-tajawal text-slate-100"><LandingPage /></div>} />
        <Route path="/login"    element={<div className="min-h-screen bg-bg font-tajawal text-slate-100"><LoginPage /></div>} />
        <Route path="/register" element={<div className="min-h-screen bg-bg font-tajawal text-slate-100"><RegisterPage /></div>} />
        <Route path="/coach/register" element={<div className="min-h-screen bg-bg font-tajawal text-slate-100"><CoachRegisterPage /></div>} />

        {/* User — Private */}
        <Route path="/dashboard"   element={<PrivateRoute><AppLayout><DashboardPage /></AppLayout></PrivateRoute>} />
        <Route path="/workout"     element={<PrivateRoute><AppLayout><WorkoutPage /></AppLayout></PrivateRoute>} />
        <Route path="/nutrition"   element={<PrivateRoute><AppLayout><NutritionPage /></AppLayout></PrivateRoute>} />
        <Route path="/chat"        element={<PrivateRoute><AppLayout><ChatPage /></AppLayout></PrivateRoute>} />
        <Route path="/progress"    element={<PrivateRoute><AppLayout><ProgressPage /></AppLayout></PrivateRoute>} />
        <Route path="/profile"     element={<PrivateRoute><AppLayout><ProfilePage /></AppLayout></PrivateRoute>} />
        <Route path="/goal-details" element={<PrivateRoute><AppLayout><GoalDetailsPage /></AppLayout></PrivateRoute>} /> {/* NEW (goal redesign) */}
        <Route path="/weekly-plan" element={<PrivateRoute><AppLayout><WeeklyPlanPage /></AppLayout></PrivateRoute>} />
        <Route path="/premium"     element={<PrivateRoute><AppLayout><PremiumPage /></AppLayout></PrivateRoute>} />
        <Route path="/exercise/:dayName/:exerciseId"
          element={<PrivateRoute><AppLayout><ExerciseDetailPage /></AppLayout></PrivateRoute>} />

        {/* Admin — Protected */}
        <Route path="/admin"               element={<AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute>} />
        <Route path="/admin/users"         element={<AdminRoute><AdminLayout><AdminUsers /></AdminLayout></AdminRoute>} />
        <Route path="/admin/users/:id"     element={<AdminRoute><AdminLayout><AdminUserDetail /></AdminLayout></AdminRoute>} />
        {/* Admin exercises removed */}
        <Route path="/admin/coaches"       element={<AdminRoute><AdminLayout><AdminCoaches /></AdminLayout></AdminRoute>} />
        <Route path="/admin/subscriptions" element={<AdminRoute><AdminLayout><AdminSubscriptions /></AdminLayout></AdminRoute>} />
        <Route path="/admin/profit"       element={<AdminRoute><AdminLayout><AdminProfit /></AdminLayout></AdminRoute>} />
        {/* Admin settings removed */}

        {/* Coach — Protected */}
        <Route path="/coach"           element={<CoachRoute><CoachLayout><CoachDashboard /></CoachLayout></CoachRoute>} />
        <Route path="/coach/workout"   element={<CoachRoute><CoachLayout><CoachUserWorkout /></CoachLayout></CoachRoute>} />
        <Route path="/coach/nutrition" element={<CoachRoute><CoachLayout><CoachUserNutrition /></CoachLayout></CoachRoute>} />
        <Route path="/coach/chat"      element={<CoachRoute><CoachLayout><CoachChat /></CoachLayout></CoachRoute>} />
        <Route path="/coach/progress"  element={<CoachRoute><CoachLayout><CoachUserProgress /></CoachLayout></CoachRoute>} />
        <Route path="/coach/profile"   element={<CoachRoute><CoachLayout><CoachProfile /></CoachLayout></CoachRoute>} />
        <Route path="/coach/earnings"  element={<CoachRoute><CoachLayout><CoachEarnings /></CoachLayout></CoachRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}