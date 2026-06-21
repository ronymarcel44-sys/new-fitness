// fitai-backend/src/middleware/auth.ts
//
// This middleware runs BEFORE any protected route handler.
// It reads the Bearer token from the Authorization header,
// verifies it, and attaches the decoded user info to req.user.
//
// Usage in any route file:
//   router.get("/me", authenticate, (req, res) => {
//     console.log(req.user.userId); // available here
//   });

import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../lib/jwt";

// Extend the Express Request type so TypeScript knows req.user exists
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // The header must look like: Authorization: Bearer eyJhbGci...
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  // Extract the token part after "Bearer "
  const token = authHeader.split(" ")[1];

  try {
    // Decode and verify — throws if expired or tampered with
    req.user = verifyToken(token);
    next(); // token is valid, continue to the route handler
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
