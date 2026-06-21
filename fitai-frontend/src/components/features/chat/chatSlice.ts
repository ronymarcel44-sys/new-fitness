// src/features/chat/chatSlice.ts
//
// Changes from Phase 2:
// - fetchChatThunk:   GET /chat     — reload conversation on app start
// - saveMessageThunk: POST /chat    — persist every message to DB
// - clearChatThunk:   DELETE /chat  — clear conversation on DB too

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { apiRequest } from "@/lib/api";
import type { Message } from "@/types";

interface BackendMessage {
  id:        string;
  role:      "user" | "assistant";
  content:   string;
  timestamp: string;
}

function backendToMessage(m: BackendMessage): Message {
  return {
    id:        m.id,
    role:      m.role === "assistant" ? "ai" : "user",
    text:      m.content,
    timestamp: new Date(m.timestamp).getTime(),
  };
}

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const fetchChatThunk = createAsyncThunk<Message[], void>(
  "chat/fetch",
  async () => {
    const messages = await apiRequest<BackendMessage[]>("GET", "/chat");
    return messages.map(backendToMessage);
  }
);

export const saveMessageThunk = createAsyncThunk<
  void,
  { role: "user" | "ai"; text: string }
>(
  "chat/save",
  async ({ role, text }) => {
    await apiRequest("POST", "/chat", {
      role:    role === "ai" ? "assistant" : "user",
      content: text,
    });
  }
);

export const clearChatThunk = createAsyncThunk<void, void>(
  "chat/clear",
  async () => {
    await apiRequest("DELETE", "/chat");
  }
);

// ── State ─────────────────────────────────────────────────────────────────────

interface ChatState {
  messages:      Message[];
  isLoading:     boolean;
  setupComplete: boolean;
  fetched:       boolean;   // true once the initial GET /chat has settled
}

const initialState: ChatState = {
  messages:      [],
  isLoading:     false,
  setupComplete: false,
  fetched:       false,
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addMessage(state, action: PayloadAction<Omit<Message, "id" | "timestamp">>) {
      state.messages.push({
        ...action.payload,
        id:        crypto.randomUUID(),
        timestamp: Date.now(),
      });
    },

    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },

    setSetupComplete(state) {
      state.setupComplete = true;
    },

    clearChat(state) {
      state.messages      = [];
      state.setupComplete = false;
    },
  },

  extraReducers: (builder) => {
    // A fresh load is starting — gate the welcome message until it settles
    builder.addCase(fetchChatThunk.pending, (state) => {
      state.fetched = false;
    });
    builder.addCase(fetchChatThunk.fulfilled, (state, action) => {
      state.messages = action.payload;
      state.fetched  = true;
      // If substantial history exists, assume setup is done
      if (action.payload.length > 14) {
        state.setupComplete = true;
      }
    });
    // Even if the server is unreachable, let the welcome message show
    builder.addCase(fetchChatThunk.rejected, (state) => {
      state.fetched = true;
    });
  },
});

export const { addMessage, setLoading, setSetupComplete, clearChat } = chatSlice.actions;
export default chatSlice.reducer;