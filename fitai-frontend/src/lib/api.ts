// src/lib/api.ts
//
// Central API utility — every backend call goes through here.
//
// Fix: previously read the token from localStorage, which created a race condition.
// After login the token is in Redux immediately but localStorage is only updated
// after a 500ms throttle, so fetch thunks fired right after login got a 401.
// Now we read from the Redux store directly.

import { store } from "@/app/store";
import { setAccessToken, logout } from "@/features/auth/authSlice";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

function getToken(): string | null {
  return store.getState().auth.accessToken || null;
}

function getRefreshToken(): string | null {
  return store.getState().auth.refreshToken || null;
}

// Tracks an in-flight refresh so multiple concurrent 401s share one refresh call
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        store.dispatch(logout());
        return null;
      }
      const data = await res.json();
      store.dispatch(setAccessToken(data.accessToken));
      return data.accessToken as string;
    } catch {
      store.dispatch(logout());
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function doFetch(path: string, method: string, body: unknown, token: string | null) {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export async function apiRequest<T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  let token = getToken();
  let response = await doFetch(path, method, body, token);

  // If access token expired, try to refresh once and retry the request
  if (response.status === 401 && getRefreshToken() && path !== "/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await doFetch(path, method, body, newToken);
    }
  }

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.error ?? `Request failed with status ${response.status}`) as
      Error & { status?: number; retryAfter?: number };
    err.status = response.status;
    if (typeof data.retryAfter === "number") err.retryAfter = data.retryAfter;
    throw err;
  }

  return data as T;
}
