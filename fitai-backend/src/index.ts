// fitai-backend/src/index.ts
import "dotenv/config";
import express from "express";
import cors    from "cors";

import authRoutes      from "./routes/auth.routes";      // Step 3
import userRoutes      from "./routes/user.routes";      // Step 5
import workoutRoutes   from "./routes/workout.routes";   // Step 6
import nutritionRoutes from "./routes/nutrition.routes"; // Step 7
import progressRoutes  from "./routes/progress.routes";  // Step 8
import chatRoutes      from "./routes/chat.routes";      // Step 8
import adminRoutes     from "./routes/admin.routes";     // Step 9
import coachRoutes     from "./routes/coach.routes";     // Step 10
import aiRoutes        from "./routes/ai.routes";        // Step 11
import paymentRoutes   from "./routes/payment.routes";   // Stripe premium upgrade
import notificationRoutes from "./routes/notifications.routes"; // bell notifications

const app  = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
// CORS — allow the configured frontend URL(s), plus any localhost / 127.0.0.1
// origin (so it works whether the app is opened via localhost, 127.0.0.1, or a
// different dev port). FRONTEND_URL may be a comma-separated list.
const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (curl, mobile apps) that send no Origin header
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Any localhost / 127.0.0.1 origin (any port) is allowed in development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" })); // increased for long AI plan responses

// Health
app.get("/",       (_req, res) => res.json({ message: "FitAI API ✅", version: "1.0.0" }));
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Routes
app.use("/auth",      authRoutes);
app.use("/users",     userRoutes);
app.use("/workout",   workoutRoutes);
app.use("/nutrition", nutritionRoutes);
app.use("/progress",  progressRoutes);
app.use("/chat",      chatRoutes);
app.use("/admin",     adminRoutes);
app.use("/coach",     coachRoutes);
app.use("/ai",        aiRoutes);
app.use("/payment",   paymentRoutes);
app.use("/notifications", notificationRoutes);

app.listen(PORT, () => {
  console.log(`\n🚀 FitAI Backend running on http://localhost:${PORT}`);
  console.log(`🔐 Auth      /auth/login`);
  console.log(`👤 Profile   /users/me`);
  console.log(`💪 Workout   /workout`);
  console.log(`🍎 Nutrition /nutrition`);
  console.log(`📊 Progress  /progress`);
  console.log(`💬 Chat      /chat`);
  console.log(`🛡️  Admin     /admin/*`);
  console.log(`🏋️  Coach     /coach/*`);
  console.log(`🤖 AI        /ai/chat\n`);
});

export default app;
