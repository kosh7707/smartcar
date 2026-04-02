import type { Request, Response, NextFunction } from "express";
import type { UserService } from "../services/user.service";

export function createAuthMiddleware(userService: UserService, required: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const user = userService.validateSession(token);
      if (user) {
        req.user = { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
      }
    }

    if (required && !req.user) {
      // /health와 /api/auth는 인증 면제
      const path = req.path;
      if (path === "/health" || path.startsWith("/api/auth")) {
        return next();
      }
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    next();
  };
}
