import { Router } from "express";
import type { UserService } from "../services/user.service";
import { asyncHandler } from "../middleware/async-handler";
import { InvalidInputError } from "../lib/errors";

export function createAuthRouter(userService: UserService): Router {
  const router = Router();

  router.post("/login", asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) throw new InvalidInputError("username and password required");
    const result = userService.authenticate(username, password);
    res.json({ success: true, data: result });
  }));

  router.post("/logout", asyncHandler(async (req, res) => {
    const token = req.headers.authorization?.slice(7);
    if (token) userService.logout(token);
    res.json({ success: true });
  }));

  router.get("/me", asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    res.json({ success: true, data: req.user });
  }));

  router.get("/users", asyncHandler(async (req, res) => {
    const users = userService.findAll();
    res.json({ success: true, data: users });
  }));

  return router;
}
