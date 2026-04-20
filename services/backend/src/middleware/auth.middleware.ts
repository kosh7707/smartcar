import type { Request, Response, NextFunction } from "express";
import type { UserService } from "../services/user.service";

const PUBLIC_AUTH_ROUTES = new Set([
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "GET /api/auth/orgs/",
  "POST /api/auth/register",
  "GET /api/auth/registrations/lookup/",
  "POST /api/auth/password-reset/request",
  "POST /api/auth/password-reset/confirm",
  "GET /health",
]);

function isPublicRoute(req: Request): boolean {
  if (req.path === "/health") return true;
  const key = `${req.method.toUpperCase()} ${req.path}`;
  if (PUBLIC_AUTH_ROUTES.has(key)) return true;
  if (req.method.toUpperCase() === "GET" && req.path.startsWith("/api/auth/orgs/")) return true;
  if (req.method.toUpperCase() === "GET" && req.path.startsWith("/api/auth/registrations/lookup/")) return true;
  return false;
}

export function createAuthMiddleware(userService: UserService, required: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const user = userService.validateSession(token);
      if (user) {
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          accountStatus: user.accountStatus,
          organizationId: user.organizationId,
          organizationCode: user.organizationCode,
          organizationName: user.organizationName,
        };
      }
    }

    if (required && !req.user) {
      if (isPublicRoute(req)) {
        return next();
      }
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    next();
  };
}
