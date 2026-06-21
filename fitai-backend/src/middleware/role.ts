// fitai-backend/src/middleware/role.ts
//
// This middleware runs AFTER authenticate.
// It checks that req.user.role matches one of the allowed roles.
//
// Usage example:
//   router.get("/admin/users", authenticate, requireRole("admin"), handler);
//   router.get("/coach/users", authenticate, requireRole("coach"), handler);
//   router.get("/data",        authenticate, requireRole("admin", "coach"), handler);

import { Request, Response, NextFunction } from "express";

// Returns a middleware function that only passes through if the user has the right role
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // req.user is set by authenticate — if it's missing, something is wrong
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // Check if the user's role is in the allowed list
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Access denied — insufficient permissions" });
      return;
    }

    next(); // role is allowed, continue to the route handler
  };
}
