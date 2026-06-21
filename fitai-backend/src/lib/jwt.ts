// fitai-backend/src/lib/jwt.ts
//
// All JWT logic lives here — every other file imports from here
// instead of calling jsonwebtoken directly.
//
// Why two tokens?
// - Access token:  short-lived (15min), sent with every API request
// - Refresh token: long-lived (7d),  only used to get a new access token
//   This way if an access token is stolen it expires quickly

import jwt from "jsonwebtoken";

// Shape of data we store inside every token
export interface TokenPayload {
  userId: string;
  role:   string; // "user" | "admin" | "coach"
}

// Read secrets and expiry times from .env
const SECRET          = process.env.JWT_SECRET          as string;
const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES  ?? "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES ?? "7d";

// Create a short-lived access token
// Used: returned on login, sent in Authorization header with every request
export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions);
}

// Create a long-lived refresh token
// Used: returned on login, stored by the client, sent to /auth/refresh when access token expires
export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions);
}

// Verify any token — throws an error if the token is invalid or expired
// The calling code should wrap this in try/catch
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}
