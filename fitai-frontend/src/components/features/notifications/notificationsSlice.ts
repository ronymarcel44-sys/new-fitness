// src/features/notifications/notificationsSlice.ts
// Bell notifications for the logged-in account (user or coach).

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { apiRequest } from "@/lib/api";
import type { AppNotification } from "@/types";

interface NotificationsState {
  list:        AppNotification[];
  unreadCount: number;
}

const initialState: NotificationsState = {
  list:        [],
  unreadCount: 0,
};

export const fetchNotificationsThunk = createAsyncThunk<AppNotification[], void>(
  "notifications/fetch",
  async () => apiRequest<AppNotification[]>("GET", "/notifications")
);

export const fetchNotifUnreadThunk = createAsyncThunk<number, void>(
  "notifications/unread",
  async () => (await apiRequest<{ count: number }>("GET", "/notifications/unread-count")).count
);

export const markNotifsReadThunk = createAsyncThunk<void, void>(
  "notifications/markRead",
  async () => { await apiRequest("POST", "/notifications/mark-read"); }
);

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchNotificationsThunk.fulfilled, (state, action) => {
      state.list = action.payload;
    });
    builder.addCase(fetchNotifUnreadThunk.fulfilled, (state, action) => {
      state.unreadCount = action.payload;
    });
    builder.addCase(markNotifsReadThunk.fulfilled, (state) => {
      state.unreadCount = 0;
      state.list.forEach((n) => { n.read = true; });
    });
  },
});

export default notificationsSlice.reducer;
