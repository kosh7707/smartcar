import { Router } from "express";
import type { UserRole } from "@aegis/shared";
import type { UserService } from "../services/user.service";
import { asyncHandler } from "../middleware/async-handler";
import { ForbiddenError, InvalidInputError } from "../lib/errors";

function parseStatus(raw: unknown): "pending_admin_review" | "approved" | "rejected" | undefined {
  if (raw === undefined) return undefined;
  if (raw === "pending_admin_review" || raw === "approved" || raw === "rejected") {
    return raw;
  }
  throw new InvalidInputError("Unsupported registration request status filter");
}

function parseRole(raw: unknown): UserRole {
  if (raw === "viewer" || raw === "analyst" || raw === "admin") {
    return raw;
  }
  throw new InvalidInputError("role must be one of viewer, analyst, admin");
}

function requireAuthenticatedUser(req: Express.Request): NonNullable<Express.Request["user"]> {
  if (!req.user) {
    throw new ForbiddenError("Authentication required");
  }
  return req.user;
}

export function createAuthRouter(userService: UserService): Router {
  const router = Router();

  router.post("/login", asyncHandler(async (req, res) => {
    const { username, password, rememberMe } = req.body as {
      username?: string;
      password?: string;
      rememberMe?: boolean;
    };
    if (!username || !password) throw new InvalidInputError("username and password required");
    const result = userService.authenticate(username, password, rememberMe === true, req.ip ?? "unknown");
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
    const actor = requireAuthenticatedUser(req);
    const users = userService.findVisibleUsers(actor);
    res.json({ success: true, data: users });
  }));

  router.get("/orgs/:code/verify", asyncHandler(async (req, res) => {
    const preview = userService.verifyOrganization(req.params.code as string, req.ip ?? "unknown");
    res.json({ success: true, data: preview });
  }));

  router.post("/register", asyncHandler(async (req, res) => {
    const { fullName, email, password, orgCode, termsAcceptedAt, auditAcceptedAt } = req.body as {
      fullName?: string;
      email?: string;
      password?: string;
      orgCode?: string;
      termsAcceptedAt?: string;
      auditAcceptedAt?: string;
    };
    if (!fullName || !email || !password || !orgCode || !termsAcceptedAt || !auditAcceptedAt) {
      throw new InvalidInputError("fullName, email, password, orgCode, termsAcceptedAt, auditAcceptedAt are required");
    }
    const result = userService.submitRegistration({
      fullName,
      email,
      password,
      orgCode,
      termsAcceptedAt,
      auditAcceptedAt,
      ipAddress: req.ip ?? "unknown",
    });
    res.status(202).json({ success: true, data: result });
  }));

  router.get("/registrations/lookup/:lookupToken", asyncHandler(async (req, res) => {
    const result = userService.lookupRegistration(req.params.lookupToken as string);
    res.json({ success: true, data: result });
  }));

  router.get("/registration-requests", asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);
    const result = userService.listRegistrationRequests(actor, parseStatus(req.query.status));
    res.json({ success: true, data: result });
  }));

  router.get("/registration-requests/:id", asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);
    const result = userService.getRegistrationRequest(actor, req.params.id as string);
    res.json({ success: true, data: result });
  }));

  router.post("/registration-requests/:id/approve", asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);
    const role = parseRole((req.body as { role?: unknown }).role);
    const result = userService.approveRegistration(actor, req.params.id as string, role);
    res.json({ success: true, data: result });
  }));

  router.post("/registration-requests/:id/reject", asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);
    const reason = (req.body as { reason?: string }).reason;
    if (!reason) {
      throw new InvalidInputError("reason is required");
    }
    const result = userService.rejectRegistration(actor, req.params.id as string, reason);
    res.json({ success: true, data: result });
  }));

  router.post("/password-reset/request", asyncHandler(async (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email) throw new InvalidInputError("email is required");
    const normalizedEmail = email;
    await userService.requestPasswordReset(normalizedEmail, req.ip ?? "unknown");
    res.status(202).json({ success: true, data: { accepted: true } });
  }));

  router.get("/dev/password-reset/latest", asyncHandler(async (req, res) => {
    const email = req.query.email;
    if (typeof email !== "string" || !email) {
      throw new InvalidInputError("email query is required");
    }
    const result = userService.getLatestDevPasswordResetDelivery(email);
    res.json({ success: true, data: result });
  }));

  router.post("/password-reset/confirm", asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || !newPassword) {
      throw new InvalidInputError("token and newPassword are required");
    }
    const result = userService.confirmPasswordReset(token, newPassword);
    res.json({ success: true, data: result });
  }));

  return router;
}
