// src/features/messages/messagesSlice.ts
//
// The premium user's side of the direct chat with their assigned coach.
// (The coach's side lives in coachSlice, keyed per client.)

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { apiRequest } from "@/lib/api";
import type { CoachMessage } from "@/types";

interface MessagesState {
  thread:      CoachMessage[];
  unreadCount: number;
  open:        boolean;   // is the floating chat panel open?
}

const initialState: MessagesState = {
  thread:      [],
  unreadCount: 0,
  open:        false,
};

// Load the full thread — the backend marks the coach's messages as read.
export const fetchMessagesThunk = createAsyncThunk<CoachMessage[], void>(
  "messages/fetch",
  async () => apiRequest<CoachMessage[]>("GET", "/users/me/messages")
);

// Lightweight unread count for the bubble badge (does not mark anything read).
export const fetchUnreadCountThunk = createAsyncThunk<number, void>(
  "messages/unread",
  async () => (await apiRequest<{ count: number }>("GET", "/users/me/messages/unread-count")).count
);

export const sendMessageThunk = createAsyncThunk<CoachMessage, string>(
  "messages/send",
  async (text) => apiRequest<CoachMessage>("POST", "/users/me/messages", { text })
);

const messagesSlice = createSlice({
  name: "messages",
  initialState,
  reducers: {
    setChatOpen(state, action: PayloadAction<boolean>) {
      state.open = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchMessagesThunk.fulfilled, (state, action) => {
      state.thread      = action.payload;
      state.unreadCount = 0;  // opening the thread marks coach messages read
    });
    builder.addCase(fetchUnreadCountThunk.fulfilled, (state, action) => {
      state.unreadCount = action.payload;
    });
    builder.addCase(sendMessageThunk.fulfilled, (state, action) => {
      state.thread.push(action.payload);
    });
  },
});

export const { setChatOpen } = messagesSlice.actions;
export default messagesSlice.reducer;
