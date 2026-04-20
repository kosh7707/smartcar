import type { User, LoginResponse } from "@aegis/shared";
import { apiFetch } from "./core";

const TOKEN_KEY = "aegis:authToken";
const MOCK_USER_KEY = "aegis:mockUser";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function readMockUser(): User | null {
  const raw = localStorage.getItem(MOCK_USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(MOCK_USER_KEY);
    return null;
  }
}

function writeMockUser(user: User): void {
  localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
}

function clearMockUser(): void {
  localStorage.removeItem(MOCK_USER_KEY);
}

function buildMockUser(username: string): User {
  const now = new Date().toISOString();
  const normalized = username.trim() || "operator";
  const displayName = normalized.includes("@") ? normalized.split("@")[0] : normalized;
  return {
    id: `mock-${displayName.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`,
    username: normalized,
    displayName,
    role: "admin",
    createdAt: now,
    updatedAt: now,
  };
}

function isMockAuthEnabled(): boolean {
  return import.meta.env.VITE_MOCK === "true";
}

function createMockToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `mock-token:${crypto.randomUUID()}`;
  }
  return `mock-token:${Date.now().toString(36)}`;
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  if (isMockAuthEnabled()) {
    const user = buildMockUser(username);
    const token = createMockToken();
    setAuthToken(token);
    writeMockUser(user);
    return { token, user };
  }

  const res = await apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = res.data!;
  setAuthToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  if (isMockAuthEnabled()) {
    clearAuthToken();
    clearMockUser();
    return;
  }

  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } finally {
    clearAuthToken();
  }
}

export async function fetchCurrentUser(): Promise<User> {
  if (isMockAuthEnabled()) {
    const user = readMockUser();
    if (!user) {
      clearAuthToken();
      throw new Error("로그인된 사용자가 없습니다.");
    }
    return user;
  }

  const res = await apiFetch<{ success: boolean; data: User }>("/api/auth/me");
  return res.data;
}

export async function fetchUsers(): Promise<User[]> {
  if (isMockAuthEnabled()) {
    const user = readMockUser();
    return user ? [user] : [];
  }

  const res = await apiFetch<{ success: boolean; data: User[] }>("/api/auth/users");
  return res.data;
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (isMockAuthEnabled()) {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    return;
  }

  await apiFetch("/api/auth/password-reset/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<{ token: string; user: User }> {
  if (isMockAuthEnabled()) {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    const user = buildMockUser("operator");
    const authToken = createMockToken();
    setAuthToken(authToken);
    writeMockUser(user);
    return { token: authToken, user };
  }

  const res = await apiFetch<{ success: boolean; data: { token: string; user: User } }>("/api/auth/password-reset/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  setAuthToken(res.data.token);
  return res.data;
}
