import type { User, LoginResponse } from "@aegis/shared";
import { apiFetch } from "./core";

const TOKEN_KEY = "aegis:authToken";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
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
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } finally {
    clearAuthToken();
  }
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await apiFetch<{ success: boolean; data: User }>("/api/auth/me");
  return res.data;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await apiFetch<{ success: boolean; data: User[] }>("/api/auth/users");
  return res.data;
}
