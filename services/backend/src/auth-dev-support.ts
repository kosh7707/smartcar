import type { UserRole } from "@aegis/shared";

export interface AuthDevOrganizationFixture {
  id: string;
  code: string;
  name: string;
  region: string;
  defaultRole: UserRole;
  emailDomainHint?: string;
  adminDisplayName: string;
  adminEmail: string;
  adminUsername: string;
}

function readBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return !["0", "false", "no", "off"].includes(raw.trim().toLowerCase());
}

function isLocalDevRuntime(): boolean {
  return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
}

export function isAuthDevFixtureSeedingEnabled(): boolean {
  return readBooleanEnv("AEGIS_AUTH_DEV_FIXTURES", isLocalDevRuntime());
}

export function isAuthDevPasswordResetBridgeEnabled(): boolean {
  return readBooleanEnv("AEGIS_AUTH_DEV_PASSWORD_RESET_BRIDGE", isLocalDevRuntime());
}

export function getAuthDevFixtureAdminPassword(): string {
  return process.env.AEGIS_AUTH_DEV_ADMIN_PASSWORD ?? "Admin1234!";
}

export const AUTH_DEV_ORGANIZATION_FIXTURES: readonly AuthDevOrganizationFixture[] = Object.freeze([
  {
    id: "org-acme-kr-sec",
    code: "ACME-KR-SEC",
    name: "ACME Corp · Security Team",
    region: "kr-seoul-1",
    defaultRole: "analyst",
    emailDomainHint: "acme.kr",
    adminDisplayName: "ACME Security Admin",
    adminEmail: "admin@acme.kr",
    adminUsername: "acme-admin",
  },
  {
    id: "org-hyundai-avsec",
    code: "HYUNDAI-AVSEC",
    name: "현대차 AV Security",
    region: "kr-seoul-1",
    defaultRole: "analyst",
    emailDomainHint: "hmc.co.kr",
    adminDisplayName: "현대차 AV Security Admin",
    adminEmail: "av-sec@hmc.co.kr",
    adminUsername: "hyundai-admin",
  },
  {
    id: "org-lg-ev-secops",
    code: "LG-EV-SECOPS",
    name: "LG Energy EV SecOps",
    region: "kr-seoul-1",
    defaultRole: "analyst",
    emailDomainHint: "lges.com",
    adminDisplayName: "LG EV SecOps Admin",
    adminEmail: "secops@lges.com",
    adminUsername: "lges-admin",
  },
]);
