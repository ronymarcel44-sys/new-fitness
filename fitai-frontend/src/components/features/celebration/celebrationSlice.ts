// src/features/celebration/celebrationSlice.ts
//
// A tiny queue of celebration toasts. Anything in the app can dispatch
// `celebrate({ emoji, title, message })` when the user achieves something
// (a streak badge, a weight milestone, reaching their goal). CelebrationToast
// renders them one at a time. Purely additive — no other slice depends on it.

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface Celebration {
  id:      string;
  emoji:   string;
  title:   string;
  message: string;
}

interface CelebrationState {
  queue: Celebration[];
}

const initialState: CelebrationState = { queue: [] };

const celebrationSlice = createSlice({
  name: "celebration",
  initialState,
  reducers: {
    celebrate(state, action: PayloadAction<Omit<Celebration, "id">>) {
      // Guard against the same celebration stacking up (e.g. double dispatch)
      const last = state.queue[state.queue.length - 1];
      if (last && last.title === action.payload.title && last.message === action.payload.message) return;
      state.queue.push({ id: crypto.randomUUID(), ...action.payload });
    },
    dismissCelebration(state) {
      state.queue.shift();
    },
  },
});

export const { celebrate, dismissCelebration } = celebrationSlice.actions;
export default celebrationSlice.reducer;
