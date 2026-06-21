// src/lib/gemini.ts
//
// Step 11: the Groq API key is no longer in the frontend.
// This file now calls the backend /ai/chat endpoint which proxies to Groq
// using the server-side GROQ_API_KEY. The system prompt is also on the server.
//
// parsePlanFromText is unchanged — it's a pure client-side JSON extractor.

import { apiRequest } from "@/lib/api";
import type { UserProfile, WorkoutPlan, NutritionPlan } from "@/types";

// Call the backend AI proxy
// Returns the assistant's reply text, same as before
export async function askGemini(messages: { role: string; text: string }[]): Promise<string> {
  const { reply } = await apiRequest<{ reply: string }>("POST", "/ai/chat", { messages });
  return reply;
}

// Extract the JSON plan from the AI response text — unchanged from previous version
export function parsePlanFromText(text: string): {
  profile?:   Partial<UserProfile>;
  workout?:   WorkoutPlan;
  nutrition?: NutritionPlan;
} | null {
  try {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (!match) return null;
    const parsed = JSON.parse(match[1]);

    const workout: WorkoutPlan = parsed.weeklyPlan
      ? { exercises: [], weeklyPlan: parsed.weeklyPlan }
      : parsed.workout;

    return {
      profile:   parsed.profile,
      workout,
      nutrition: parsed.nutrition,
    };
  } catch { return null; }
}
