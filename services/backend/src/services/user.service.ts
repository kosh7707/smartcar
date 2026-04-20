import crypto, { randomBytes, scryptSync } from "crypto";
import type {
  DevPasswordResetDelivery,
  OrganizationVerifyPreview,
  RegistrationRequest,
  RegistrationRequestStatus,
  User,
  UserRole,
} from "@aegis/shared";
import type {
  DevPasswordResetDeliveryDAO,
  OrganizationDAO,
  PasswordResetTokenDAO,
  RegistrationRequestDAO,
  SessionDAO,
  UserDAO,
} from "../dao/user.dao";
import { isAuthDevPasswordResetBridgeEnabled } from "../auth-dev-support";
import type { AuthRateLimitDAO } from "../dao/auth-rate-limit.dao";
import { ConflictError, ForbiddenError, InvalidInputError, NotFoundError, RateLimitError } from "../lib/errors";
import { createLogger } from "../lib/logger";

const logger = createLogger("user-service");

export const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const REMEMBER_ME_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const REGISTRATION_LOOKUP_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

const PASSWORD_RESET_IP_LIMIT = { limit: 5, windowMs: 60 * 1000 };
const PASSWORD_RESET_EMAIL_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };
const ORG_VERIFY_IP_LIMIT = { limit: 10, windowMs: 60 * 1000 };
const REGISTRATION_IP_LIMIT = { limit: 5, windowMs: 60 * 1000 };
const REGISTRATION_PENDING_PER_EMAIL_LIMIT = 3;
const REGISTRATION_PENDING_PER_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOGIN_IP_LIMIT = { limit: 10, windowMs: 60 * 1000 };
const LOGIN_IDENTIFIER_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 };

type AuthenticatedActor = NonNullable<Express.Request["user"]>;

interface TimestampLimit {
  limit: number;
  windowMs: number;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return hash === derived;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateOpaqueToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function assertIsoTimestamp(value: string, fieldName: string): void {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new InvalidInputError(`${fieldName} must be a valid ISO 8601 timestamp`);
  }
}

function assertStrongPassword(password: string): void {
  if (password.length < 8) {
    throw new InvalidInputError("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    throw new InvalidInputError("Password must include an uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    throw new InvalidInputError("Password must include a lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    throw new InvalidInputError("Password must include a number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new InvalidInputError("Password must include a special character");
  }
}

export class UserService {
  constructor(
    private userDAO: UserDAO,
    private sessionDAO: SessionDAO,
    private organizationDAO: OrganizationDAO,
    private registrationRequestDAO: RegistrationRequestDAO,
    private passwordResetTokenDAO: PasswordResetTokenDAO,
    private authRateLimitDAO: AuthRateLimitDAO,
    private devPasswordResetDeliveryDAO: DevPasswordResetDeliveryDAO,
  ) {}

  createUser(
    username: string,
    password: string,
    displayName: string,
    role: UserRole = "analyst",
    options?: {
      email?: string;
      organizationId?: string | null;
      accountStatus?: "active" | "disabled";
    },
  ): User {
    if (!username || username.length < 2) throw new InvalidInputError("Username must be at least 2 characters");
    if (!password || password.length < 4) throw new InvalidInputError("Password must be at least 4 characters");
    const existing = this.userDAO.findByUsername(username);
    if (existing) throw new InvalidInputError(`Username already exists: ${username}`);
    const normalizedEmail = options?.email ? normalizeEmail(options.email) : undefined;
    if (normalizedEmail && this.userDAO.findByEmail(normalizedEmail)) {
      throw new ConflictError(`Email already exists: ${normalizedEmail}`);
    }

    return this.persistUser({
      username,
      email: normalizedEmail,
      displayName: displayName || username,
      passwordHash: hashPassword(password),
      role,
      organizationId: options?.organizationId ?? null,
      accountStatus: options?.accountStatus ?? "active",
    });
  }

  authenticate(identifier: string, password: string, rememberMe = false, ipAddress = "direct"): { token: string; expiresAt: string; user: User } {
    const lookup = identifier.trim();
    this.recordIpRateLimit(`login:${ipAddress}`, LOGIN_IP_LIMIT, "Too many login attempts");
    this.recordIdentifierRateLimit(`login:${normalizeEmail(lookup)}`, LOGIN_IDENTIFIER_LIMIT, "Too many login attempts for this identifier");
    const user = this.resolveLoginRecord(lookup);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new InvalidInputError("Invalid username or password");
    }
    if (user.accountStatus && user.accountStatus !== "active") {
      throw new ForbiddenError("Account is not active");
    }
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (rememberMe ? REMEMBER_ME_SESSION_TTL_MS : DEFAULT_SESSION_TTL_MS)).toISOString();
    this.sessionDAO.create(token, user.id, expiresAt);
    logger.info({ userId: user.id, username: user.username, rememberMe }, "User authenticated");
    const { passwordHash: _, ...safeUser } = user;
    return { token, expiresAt, user: safeUser };
  }

  validateSession(token: string): User | undefined {
    const session = this.sessionDAO.findByToken(token);
    if (!session) return undefined;
    if (new Date(session.expiresAt) < new Date()) {
      this.sessionDAO.deleteByToken(token);
      return undefined;
    }
    const user = this.userDAO.findById(session.userId);
    if (!user || (user.accountStatus && user.accountStatus !== "active")) {
      this.sessionDAO.deleteByToken(token);
      return undefined;
    }
    return user;
  }

  logout(token: string): void {
    this.sessionDAO.deleteByToken(token);
  }

  findAll(): User[] {
    return this.userDAO.findAll();
  }

  findVisibleUsers(actor: AuthenticatedActor): User[] {
    this.assertAdmin(actor);
    if (this.isPlatformAdmin(actor)) {
      return this.userDAO.findAll();
    }
    if (!actor.organizationId) {
      return [];
    }
    return this.userDAO.findByOrganizationId(actor.organizationId);
  }

  verifyOrganization(code: string, ipAddress: string): OrganizationVerifyPreview {
    this.recordIpRateLimit(`org-verify:${ipAddress}`, ORG_VERIFY_IP_LIMIT, "Too many organization verification attempts");
    const organization = this.organizationDAO.findByCode(code);
    if (!organization) {
      throw new NotFoundError(`Organization code not found: ${code}`);
    }
    return {
      orgId: organization.id,
      code: organization.code,
      name: organization.name,
      admin: {
        displayName: organization.adminDisplayName,
        email: organization.adminEmail,
      },
      region: organization.region,
      defaultRole: organization.defaultRole,
      emailDomainHint: organization.emailDomainHint,
    };
  }

  seedOrganization(input: {
    id: string;
    code: string;
    name: string;
    region: string;
    defaultRole: UserRole;
    emailDomainHint?: string;
    adminDisplayName: string;
    adminEmail: string;
  }) {
    const existing = this.organizationDAO.findByCode(input.code);
    if (existing) return existing;
    this.organizationDAO.save(input);
    logger.info({ code: input.code, organizationId: input.id }, "Organization fixture seeded");
    return this.organizationDAO.findByCode(input.code)!;
  }

  seedUserIfMissing(input: {
    username: string;
    password: string;
    displayName: string;
    role?: UserRole;
    email?: string;
    organizationId?: string | null;
    accountStatus?: "active" | "disabled";
  }): User {
    const existingByUsername = this.userDAO.findByUsername(input.username);
    if (existingByUsername) {
      const { passwordHash: _, ...safeUser } = existingByUsername;
      return safeUser;
    }
    const normalizedEmail = input.email ? normalizeEmail(input.email) : undefined;
    if (normalizedEmail) {
      const existingByEmail = this.userDAO.findByEmail(normalizedEmail);
      if (existingByEmail) {
        const { passwordHash: _, ...safeUser } = existingByEmail;
        return safeUser;
      }
    }
    return this.createUser(input.username, input.password, input.displayName, input.role ?? "analyst", {
      email: normalizedEmail,
      organizationId: input.organizationId ?? null,
      accountStatus: input.accountStatus ?? "active",
    });
  }

  submitRegistration(input: {
    fullName: string;
    email: string;
    password: string;
    orgCode: string;
    termsAcceptedAt: string;
    auditAcceptedAt: string;
    ipAddress: string;
  }): {
    registrationId: string;
    lookupToken: string;
    lookupExpiresAt: string;
    status: RegistrationRequestStatus;
    createdAt: string;
  } {
    const fullName = input.fullName.trim();
    const email = normalizeEmail(input.email);
    const orgCode = input.orgCode.trim();
    if (!fullName) throw new InvalidInputError("fullName is required");
    if (!email || !email.includes("@")) throw new InvalidInputError("email is required");
    if (!orgCode) throw new InvalidInputError("orgCode is required");
    assertStrongPassword(input.password);
    assertIsoTimestamp(input.termsAcceptedAt, "termsAcceptedAt");
    assertIsoTimestamp(input.auditAcceptedAt, "auditAcceptedAt");

    this.recordIpRateLimit(`register:${input.ipAddress}`, REGISTRATION_IP_LIMIT, "Too many registration attempts");

    const organization = this.organizationDAO.findByCode(orgCode);
    if (!organization) {
      throw new NotFoundError(`Organization code not found: ${orgCode}`);
    }
    if (this.userDAO.findByEmail(email)) {
      throw new ConflictError(`Email already exists: ${email}`);
    }
    if (this.registrationRequestDAO.findPendingByEmail(email)) {
      throw new ConflictError(`Pending registration already exists for ${email}`);
    }
    const since = new Date(Date.now() - REGISTRATION_PENDING_PER_EMAIL_WINDOW_MS).toISOString();
    if (this.registrationRequestDAO.countPendingSinceByEmail(email, since) >= REGISTRATION_PENDING_PER_EMAIL_LIMIT) {
      throw new RateLimitError("Too many pending registration requests for this email");
    }

    const registrationId = `reg-${crypto.randomUUID().slice(0, 8)}`;
    const lookupToken = generateOpaqueToken();
    const lookupExpiresAt = new Date(Date.now() + REGISTRATION_LOOKUP_TTL_MS).toISOString();
    const createdAt = nowIso();
    this.registrationRequestDAO.save({
      id: registrationId,
      organizationId: organization.id,
      fullName,
      email,
      passwordHash: hashPassword(input.password),
      termsAcceptedAt: input.termsAcceptedAt,
      auditAcceptedAt: input.auditAcceptedAt,
      lookupTokenHash: hashOpaqueToken(lookupToken),
      lookupExpiresAt,
    });

    logger.info({ registrationId, organizationId: organization.id, email }, "Registration request submitted");

    return {
      registrationId,
      lookupToken,
      lookupExpiresAt,
      status: "pending_admin_review",
      createdAt,
    };
  }

  lookupRegistration(lookupToken: string): RegistrationRequest {
    const tokenHash = hashOpaqueToken(lookupToken);
    const request = this.registrationRequestDAO.findByLookupTokenHash(tokenHash);
    if (!request) {
      throw new NotFoundError("Registration lookup token not found");
    }
    if (new Date(request.lookupExpiresAt) < new Date()) {
      throw new NotFoundError("Registration lookup token expired");
    }
    return this.registrationRequestDAO.findById(request.id)!;
  }

  listRegistrationRequests(actor: AuthenticatedActor, status?: RegistrationRequestStatus): RegistrationRequest[] {
    this.assertAdmin(actor);
    if (this.isPlatformAdmin(actor)) {
      return this.registrationRequestDAO.findAll(status);
    }
    if (!actor.organizationId) {
      return [];
    }
    return this.registrationRequestDAO.findVisibleForOrganization(actor.organizationId, status);
  }

  getRegistrationRequest(actor: AuthenticatedActor, requestId: string): RegistrationRequest {
    const request = this.registrationRequestDAO.findById(requestId);
    if (!request) {
      throw new NotFoundError(`Registration request not found: ${requestId}`);
    }
    this.assertCanReview(actor, request.organizationId);
    return request;
  }

  approveRegistration(actor: AuthenticatedActor, requestId: string, role: UserRole): RegistrationRequest {
    const request = this.registrationRequestDAO.findRecordById(requestId);
    if (!request) {
      throw new NotFoundError(`Registration request not found: ${requestId}`);
    }
    this.assertCanReview(actor, request.organizationId);
    if (request.status !== "pending_admin_review") {
      throw new ConflictError(`Registration request is not pending: ${request.status}`);
    }
    if (this.userDAO.findByEmail(request.email)) {
      throw new ConflictError(`Email already exists: ${request.email}`);
    }

    const createdUser = this.persistUser({
      username: `member-${crypto.randomUUID().slice(0, 8)}`,
      email: request.email,
      displayName: request.fullName,
      passwordHash: request.passwordHash,
      role,
      organizationId: request.organizationId,
      accountStatus: "active",
    });

    const approvedAt = nowIso();
    this.registrationRequestDAO.markApproved(request.id, {
      assignedRole: role,
      approvedUserId: createdUser.id,
      reviewedByUserId: actor.id,
      approvedAt,
    });
    logger.info({ registrationId: request.id, userId: createdUser.id, role }, "Registration request approved");
    return this.registrationRequestDAO.findById(request.id)!;
  }

  rejectRegistration(actor: AuthenticatedActor, requestId: string, reason: string): RegistrationRequest {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new InvalidInputError("reason is required");
    }
    const request = this.registrationRequestDAO.findRecordById(requestId);
    if (!request) {
      throw new NotFoundError(`Registration request not found: ${requestId}`);
    }
    this.assertCanReview(actor, request.organizationId);
    if (request.status !== "pending_admin_review") {
      throw new ConflictError(`Registration request is not pending: ${request.status}`);
    }
    const rejectedAt = nowIso();
    this.registrationRequestDAO.markRejected(request.id, {
      reason: trimmedReason,
      reviewedByUserId: actor.id,
      rejectedAt,
    });
    logger.info({ registrationId: request.id }, "Registration request rejected");
    return this.registrationRequestDAO.findById(request.id)!;
  }

  requestPasswordReset(email: string, ipAddress: string): { accepted: true; token?: string } {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new InvalidInputError("email is required");
    }
    this.recordIpRateLimit(`password-reset-ip:${ipAddress}`, PASSWORD_RESET_IP_LIMIT, "Too many password reset requests");
    this.recordEmailRateLimit(`password-reset-email:${normalizedEmail}`, PASSWORD_RESET_EMAIL_LIMIT, "Too many password reset requests for this email");

    const user = this.userDAO.findByEmail(normalizedEmail);
    if (!user || (user.accountStatus && user.accountStatus !== "active")) {
      return { accepted: true };
    }
    this.revokeOutstandingPasswordResetState(user.id, normalizedEmail);
    const token = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
    const createdAt = nowIso();
    this.passwordResetTokenDAO.save({
      id: `prt-${crypto.randomUUID().slice(0, 8)}`,
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt,
    });
    if (isAuthDevPasswordResetBridgeEnabled()) {
      this.devPasswordResetDeliveryDAO.save({
        id: `dpr-${crypto.randomUUID().slice(0, 8)}`,
        email: normalizedEmail,
        token,
        tokenHash,
        expiresAt,
        createdAt,
      });
    }
    logger.info({ userId: user.id }, "Password reset requested");
    return { accepted: true, token };
  }

  confirmPasswordReset(token: string, newPassword: string): { success: true } {
    assertStrongPassword(newPassword);
    const tokenHash = hashOpaqueToken(token);
    const tokenRecord = this.passwordResetTokenDAO.findByTokenHash(tokenHash);
    if (!tokenRecord) {
      throw new NotFoundError("Password reset token not found");
    }
    if (tokenRecord.consumedAt) {
      throw new ConflictError("Password reset token already consumed");
    }
    if (new Date(tokenRecord.expiresAt) < new Date()) {
      throw new ConflictError("Password reset token expired");
    }
    const user = this.userDAO.findRecordById(tokenRecord.userId);
    if (!user) {
      throw new NotFoundError("User not found for password reset");
    }
    const consumedAt = nowIso();
    this.userDAO.update(user.id, { passwordHash: hashPassword(newPassword) });
    this.passwordResetTokenDAO.consume(tokenRecord.id, consumedAt);
    if (isAuthDevPasswordResetBridgeEnabled()) {
      this.devPasswordResetDeliveryDAO.consumeByTokenHash(tokenHash, consumedAt);
    }
    this.revokeOutstandingPasswordResetState(user.id, user.email);
    this.sessionDAO.deleteByUserId(user.id);
    logger.info({ userId: user.id }, "Password reset completed");
    return { success: true };
  }

  seedAdmin(username: string, password: string): void {
    if (this.userDAO.count() > 0) return;
    this.createUser(username, password, "Administrator", "admin");
    logger.info({ username }, "Default admin user seeded");
  }

  getLatestDevPasswordResetDelivery(email: string): { available: boolean; delivery?: DevPasswordResetDelivery } {
    if (!isAuthDevPasswordResetBridgeEnabled()) {
      throw new NotFoundError("Dev password reset bridge is disabled");
    }
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new InvalidInputError("email is required");
    }
    const delivery = this.devPasswordResetDeliveryDAO.findLatestActiveByEmail(normalizedEmail);
    if (!delivery) {
      return { available: false };
    }
    if (delivery.consumedAt || new Date(delivery.expiresAt) < new Date()) {
      return { available: false };
    }
    return { available: true, delivery };
  }

  private resolveLoginRecord(identifier: string) {
    const byUsername = this.userDAO.findByUsername(identifier);
    if (byUsername) return byUsername;
    return this.userDAO.findByEmail(normalizeEmail(identifier));
  }

  private isPlatformAdmin(actor: AuthenticatedActor): boolean {
    return actor.role === "admin" && !actor.organizationId;
  }

  private assertAdmin(actor?: AuthenticatedActor): asserts actor is AuthenticatedActor {
    if (!actor) {
      throw new ForbiddenError("Authentication required");
    }
    if (actor.role !== "admin") {
      throw new ForbiddenError("Admin role required");
    }
  }

  private assertCanReview(actor: AuthenticatedActor | undefined, organizationId: string): void {
    this.assertAdmin(actor);
    if (this.isPlatformAdmin(actor)) return;
    if (!actor.organizationId || actor.organizationId !== organizationId) {
      throw new ForbiddenError("Admin may review only requests in the same organization");
    }
  }

  private recordIpRateLimit(key: string, limit: TimestampLimit, message: string): void {
    this.authRateLimitDAO.enforce("ip", key, limit.limit, limit.windowMs, message);
  }

  private recordEmailRateLimit(key: string, limit: TimestampLimit, message: string): void {
    this.authRateLimitDAO.enforce("email", key, limit.limit, limit.windowMs, message);
  }

  private recordIdentifierRateLimit(key: string, limit: TimestampLimit, message: string): void {
    this.authRateLimitDAO.enforce("identifier", key, limit.limit, limit.windowMs, message);
  }

  private persistUser(input: {
    username: string;
    email?: string;
    displayName: string;
    passwordHash: string;
    role: UserRole;
    organizationId?: string | null;
    accountStatus?: "active" | "disabled";
  }): User {
    const id = `user-${crypto.randomUUID().slice(0, 8)}`;
    this.userDAO.save({
      id,
      username: input.username,
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      role: input.role,
      organizationId: input.organizationId ?? null,
      accountStatus: input.accountStatus ?? "active",
    });
    logger.info({ userId: id, username: input.username, role: input.role }, "User created");
    return this.userDAO.findById(id)!;
  }

  private revokeOutstandingPasswordResetState(userId: string, email?: string): void {
    const revokedAt = nowIso();
    this.passwordResetTokenDAO.revokeActiveByUserId(userId, revokedAt);
    if (isAuthDevPasswordResetBridgeEnabled() && email) {
      this.devPasswordResetDeliveryDAO.revokeActiveByEmail(email, revokedAt);
    }
  }
}
