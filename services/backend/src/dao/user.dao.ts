import crypto from "crypto";
import type {
  Organization,
  RegistrationRequest,
  User,
  UserAccountStatus,
  UserRole,
} from "@aegis/shared";
import type { DatabaseType } from "../db";

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  display_name: string;
  password_hash: string;
  role: UserRole;
  organization_id: string | null;
  account_status: UserAccountStatus;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

interface OrganizationRow {
  id: string;
  code: string;
  name: string;
  region: string;
  default_role: UserRole;
  email_domain_hint: string | null;
  admin_display_name: string;
  admin_email: string;
  created_at: string;
  updated_at: string;
}

interface RegistrationRequestRow {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  password_hash: string;
  status: RegistrationRequest["status"];
  assigned_role: UserRole | null;
  decision_reason: string | null;
  approved_user_id: string | null;
  reviewed_by_user_id: string | null;
  terms_accepted_at: string;
  audit_accepted_at: string;
  lookup_token_hash: string;
  lookup_expires_at: string;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  organization_code?: string;
  organization_name?: string;
}

interface PasswordResetTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface UserRecord extends User {
  passwordHash: string;
}

export interface RegistrationRequestRecord extends RegistrationRequest {
  passwordHash: string;
  organizationId: string;
  reviewedByUserId?: string;
  termsAcceptedAt: string;
  auditAcceptedAt: string;
  lookupTokenHash: string;
}

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  consumedAt?: string;
  createdAt: string;
}

function rowToUser(row: UserRow, org?: { code?: string | null; name?: string | null }): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email ?? undefined,
    displayName: row.display_name,
    role: row.role,
    accountStatus: row.account_status,
    organizationId: row.organization_id,
    organizationCode: org?.code ?? undefined,
    organizationName: org?.name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    region: row.region,
    defaultRole: row.default_role,
    emailDomainHint: row.email_domain_hint ?? undefined,
    adminDisplayName: row.admin_display_name,
    adminEmail: row.admin_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRegistrationRequest(row: RegistrationRequestRow): RegistrationRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationCode: row.organization_code ?? "",
    organizationName: row.organization_name ?? "",
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    assignedRole: row.assigned_role ?? undefined,
    approvedUserId: row.approved_user_id ?? undefined,
    decisionReason: row.decision_reason ?? undefined,
    lookupExpiresAt: row.lookup_expires_at,
    createdAt: row.created_at,
    approvedAt: row.approved_at ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
  };
}

function rowToRegistrationRequestRecord(row: RegistrationRequestRow): RegistrationRequestRecord {
  return {
    ...rowToRegistrationRequest(row),
    passwordHash: row.password_hash,
    organizationId: row.organization_id,
    reviewedByUserId: row.reviewed_by_user_id ?? undefined,
    termsAcceptedAt: row.terms_accepted_at,
    auditAcceptedAt: row.audit_accepted_at,
    lookupTokenHash: row.lookup_token_hash,
  };
}

export class UserDAO {
  constructor(private db: DatabaseType) {}

  save(user: {
    id: string;
    username: string;
    displayName: string;
    passwordHash: string;
    role: UserRole;
    email?: string;
    organizationId?: string | null;
    accountStatus?: UserAccountStatus;
  }): void {
    this.db.prepare(
      `INSERT INTO users (
        id, username, email, display_name, password_hash, role, organization_id, account_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      user.id,
      user.username,
      user.email?.toLowerCase() ?? null,
      user.displayName,
      user.passwordHash,
      user.role,
      user.organizationId ?? null,
      user.accountStatus ?? "active",
    );
  }

  update(id: string, fields: Partial<{
    username: string;
    email: string | null;
    displayName: string;
    passwordHash: string;
    role: UserRole;
    organizationId: string | null;
    accountStatus: UserAccountStatus;
  }>): void {
    const existing = this.findRecordById(id);
    if (!existing) return;
    this.db.prepare(
      `UPDATE users
       SET username = ?, email = ?, display_name = ?, password_hash = ?, role = ?, organization_id = ?, account_status = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      fields.username ?? existing.username,
      fields.email !== undefined ? fields.email?.toLowerCase() ?? null : existing.email ?? null,
      fields.displayName ?? existing.displayName,
      fields.passwordHash ?? existing.passwordHash,
      fields.role ?? existing.role,
      fields.organizationId !== undefined ? fields.organizationId ?? null : existing.organizationId ?? null,
      fields.accountStatus ?? existing.accountStatus ?? "active",
      new Date().toISOString(),
      id,
    );
  }

  findById(id: string): User | undefined {
    const row = this.db.prepare(
      `SELECT u.*, o.code AS organization_code, o.name AS organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = ?`,
    ).get(id) as (UserRow & { organization_code?: string | null; organization_name?: string | null }) | undefined;
    return row
      ? rowToUser(row, { code: row.organization_code ?? undefined, name: row.organization_name ?? undefined })
      : undefined;
  }

  findRecordById(id: string): UserRecord | undefined {
    const row = this.db.prepare(
      `SELECT u.*, o.code AS organization_code, o.name AS organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = ?`,
    ).get(id) as (UserRow & { organization_code?: string | null; organization_name?: string | null }) | undefined;
    return row
      ? {
          ...rowToUser(row, { code: row.organization_code ?? undefined, name: row.organization_name ?? undefined }),
          passwordHash: row.password_hash,
        }
      : undefined;
  }

  findByUsername(username: string): UserRecord | undefined {
    const row = this.db.prepare(
      `SELECT u.*, o.code AS organization_code, o.name AS organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.username = ?`,
    ).get(username) as (UserRow & { organization_code?: string | null; organization_name?: string | null }) | undefined;
    return row
      ? {
          ...rowToUser(row, { code: row.organization_code ?? undefined, name: row.organization_name ?? undefined }),
          passwordHash: row.password_hash,
        }
      : undefined;
  }

  findByEmail(email: string): UserRecord | undefined {
    const row = this.db.prepare(
      `SELECT u.*, o.code AS organization_code, o.name AS organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE lower(u.email) = lower(?)`,
    ).get(email) as (UserRow & { organization_code?: string | null; organization_name?: string | null }) | undefined;
    return row
      ? {
          ...rowToUser(row, { code: row.organization_code ?? undefined, name: row.organization_name ?? undefined }),
          passwordHash: row.password_hash,
        }
      : undefined;
  }

  findAll(): User[] {
    return (
      this.db.prepare(
        `SELECT u.*, o.code AS organization_code, o.name AS organization_name
         FROM users u
         LEFT JOIN organizations o ON o.id = u.organization_id
         ORDER BY u.created_at`,
      ).all() as Array<UserRow & { organization_code?: string | null; organization_name?: string | null }>
    ).map((row) => rowToUser(row, { code: row.organization_code ?? undefined, name: row.organization_name ?? undefined }));
  }

  findByOrganizationId(organizationId: string): User[] {
    return (
      this.db.prepare(
        `SELECT u.*, o.code AS organization_code, o.name AS organization_name
         FROM users u
         LEFT JOIN organizations o ON o.id = u.organization_id
         WHERE u.organization_id = ?
         ORDER BY u.created_at`,
      ).all(organizationId) as Array<UserRow & { organization_code?: string | null; organization_name?: string | null }>
    ).map((row) => rowToUser(row, { code: row.organization_code ?? undefined, name: row.organization_name ?? undefined }));
  }

  count(): number {
    return (this.db.prepare(`SELECT COUNT(*) as cnt FROM users`).get() as { cnt: number }).cnt;
  }
}

export class SessionDAO {
  constructor(private db: DatabaseType) {}

  create(token: string, userId: string, expiresAt: string): void {
    const storedToken = hashSessionToken(token);
    this.db.prepare(
      `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
    ).run(storedToken, userId, expiresAt);
  }

  findByToken(token: string): { token: string; userId: string; createdAt: string; expiresAt: string } | undefined {
    const hashed = hashSessionToken(token);
    const row = this.db.prepare(`SELECT * FROM sessions WHERE token = ?`).get(hashed) as SessionRow | undefined;
    if (!row) return undefined;
    return { token: hashed, userId: row.user_id, createdAt: row.created_at, expiresAt: row.expires_at };
  }

  deleteByToken(token: string): void {
    const hashed = hashSessionToken(token);
    this.db.prepare(`DELETE FROM sessions WHERE token = ?`).run(hashed);
  }

  deleteByUserId(userId: string): number {
    return this.db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId).changes;
  }

  deleteExpired(): number {
    return this.db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run().changes;
  }
}

export class OrganizationDAO {
  constructor(private db: DatabaseType) {}

  save(org: {
    id: string;
    code: string;
    name: string;
    region: string;
    defaultRole: UserRole;
    emailDomainHint?: string;
    adminDisplayName: string;
    adminEmail: string;
  }): void {
    this.db.prepare(
      `INSERT INTO organizations (
        id, code, name, region, default_role, email_domain_hint, admin_display_name, admin_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      org.id,
      org.code,
      org.name,
      org.region,
      org.defaultRole,
      org.emailDomainHint ?? null,
      org.adminDisplayName,
      org.adminEmail.toLowerCase(),
    );
  }

  findById(id: string): Organization | undefined {
    const row = this.db.prepare(`SELECT * FROM organizations WHERE id = ?`).get(id) as OrganizationRow | undefined;
    return row ? rowToOrganization(row) : undefined;
  }

  findByCode(code: string): Organization | undefined {
    const row = this.db.prepare(`SELECT * FROM organizations WHERE code = ?`).get(code) as OrganizationRow | undefined;
    return row ? rowToOrganization(row) : undefined;
  }
}

export class RegistrationRequestDAO {
  constructor(private db: DatabaseType) {}

  save(request: {
    id: string;
    organizationId: string;
    fullName: string;
    email: string;
    passwordHash: string;
    termsAcceptedAt: string;
    auditAcceptedAt: string;
    lookupTokenHash: string;
    lookupExpiresAt: string;
  }): void {
    this.db.prepare(
      `INSERT INTO registration_requests (
        id, organization_id, full_name, email, password_hash, terms_accepted_at, audit_accepted_at,
        lookup_token_hash, lookup_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      request.id,
      request.organizationId,
      request.fullName,
      request.email.toLowerCase(),
      request.passwordHash,
      request.termsAcceptedAt,
      request.auditAcceptedAt,
      request.lookupTokenHash,
      request.lookupExpiresAt,
    );
  }

  findRecordById(id: string): RegistrationRequestRecord | undefined {
    const row = this.db.prepare(
      `SELECT rr.*, o.code AS organization_code, o.name AS organization_name
       FROM registration_requests rr
       JOIN organizations o ON o.id = rr.organization_id
       WHERE rr.id = ?`,
    ).get(id) as RegistrationRequestRow | undefined;
    return row ? rowToRegistrationRequestRecord(row) : undefined;
  }

  findById(id: string): RegistrationRequest | undefined {
    const record = this.findRecordById(id);
    return record ? rowToRegistrationRequest(record as unknown as RegistrationRequestRow) : undefined;
  }

  findByLookupTokenHash(lookupTokenHash: string): RegistrationRequestRecord | undefined {
    const row = this.db.prepare(
      `SELECT rr.*, o.code AS organization_code, o.name AS organization_name
       FROM registration_requests rr
       JOIN organizations o ON o.id = rr.organization_id
       WHERE rr.lookup_token_hash = ?`,
    ).get(lookupTokenHash) as RegistrationRequestRow | undefined;
    return row ? rowToRegistrationRequestRecord(row) : undefined;
  }

  findPendingByEmail(email: string): RegistrationRequestRecord | undefined {
    const row = this.db.prepare(
      `SELECT rr.*, o.code AS organization_code, o.name AS organization_name
       FROM registration_requests rr
       JOIN organizations o ON o.id = rr.organization_id
       WHERE lower(rr.email) = lower(?) AND rr.status = 'pending_admin_review'
       ORDER BY rr.created_at DESC
       LIMIT 1`,
    ).get(email) as RegistrationRequestRow | undefined;
    return row ? rowToRegistrationRequestRecord(row) : undefined;
  }

  countPendingSinceByEmail(email: string, since: string): number {
    return (
      this.db.prepare(
        `SELECT COUNT(*) AS cnt
         FROM registration_requests
         WHERE lower(email) = lower(?) AND status = 'pending_admin_review' AND created_at >= ?`,
      ).get(email, since) as { cnt: number }
    ).cnt;
  }

  findVisibleForOrganization(organizationId: string, status?: RegistrationRequest["status"]): RegistrationRequest[] {
    const rows = status
      ? this.db.prepare(
          `SELECT rr.*, o.code AS organization_code, o.name AS organization_name
           FROM registration_requests rr
           JOIN organizations o ON o.id = rr.organization_id
           WHERE rr.organization_id = ? AND rr.status = ?
           ORDER BY rr.created_at DESC`,
        ).all(organizationId, status)
      : this.db.prepare(
          `SELECT rr.*, o.code AS organization_code, o.name AS organization_name
           FROM registration_requests rr
           JOIN organizations o ON o.id = rr.organization_id
           WHERE rr.organization_id = ?
           ORDER BY rr.created_at DESC`,
        ).all(organizationId);
    return (rows as RegistrationRequestRow[]).map(rowToRegistrationRequest);
  }

  findAll(status?: RegistrationRequest["status"]): RegistrationRequest[] {
    const rows = status
      ? this.db.prepare(
          `SELECT rr.*, o.code AS organization_code, o.name AS organization_name
           FROM registration_requests rr
           JOIN organizations o ON o.id = rr.organization_id
           WHERE rr.status = ?
           ORDER BY rr.created_at DESC`,
        ).all(status)
      : this.db.prepare(
          `SELECT rr.*, o.code AS organization_code, o.name AS organization_name
           FROM registration_requests rr
           JOIN organizations o ON o.id = rr.organization_id
           ORDER BY rr.created_at DESC`,
        ).all();
    return (rows as RegistrationRequestRow[]).map(rowToRegistrationRequest);
  }

  markApproved(id: string, params: {
    assignedRole: UserRole;
    approvedUserId: string;
    reviewedByUserId: string;
    approvedAt: string;
  }): void {
    this.db.prepare(
      `UPDATE registration_requests
       SET status = 'approved',
           assigned_role = ?,
           approved_user_id = ?,
           reviewed_by_user_id = ?,
           approved_at = ?
       WHERE id = ?`,
    ).run(params.assignedRole, params.approvedUserId, params.reviewedByUserId, params.approvedAt, id);
  }

  markRejected(id: string, params: {
    reason: string;
    reviewedByUserId: string;
    rejectedAt: string;
  }): void {
    this.db.prepare(
      `UPDATE registration_requests
       SET status = 'rejected',
           decision_reason = ?,
           reviewed_by_user_id = ?,
           rejected_at = ?
       WHERE id = ?`,
    ).run(params.reason, params.reviewedByUserId, params.rejectedAt, id);
  }
}

export class PasswordResetTokenDAO {
  constructor(private db: DatabaseType) {}

  save(token: PasswordResetTokenRecord): void {
    this.db.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, consumed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      token.id,
      token.userId,
      token.tokenHash,
      token.expiresAt,
      token.consumedAt ?? null,
      token.createdAt,
    );
  }

  findByTokenHash(tokenHash: string): PasswordResetTokenRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM password_reset_tokens WHERE token_hash = ?`).get(tokenHash) as PasswordResetTokenRow | undefined;
    return row ? {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at ?? undefined,
      createdAt: row.created_at,
    } : undefined;
  }

  consume(id: string, consumedAt: string): void {
    this.db.prepare(`UPDATE password_reset_tokens SET consumed_at = ? WHERE id = ?`).run(consumedAt, id);
  }

  revokeActiveByUserId(userId: string, consumedAt: string): number {
    return this.db.prepare(
      `UPDATE password_reset_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL`,
    ).run(consumedAt, userId).changes;
  }
}
