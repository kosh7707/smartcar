import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";

vi.mock("./contexts/ProjectContext", () => ({
  ProjectProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./contexts/ToastContext", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./contexts/AnalysisGuardContext", () => ({
  AnalysisGuardProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./layouts/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock("./layouts/GlobalLayout", () => ({
  GlobalLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="global-layout">{children}</div>,
}));

vi.mock("./layouts/ProjectLayoutShell", () => ({
  ProjectLayoutShell: () => <div>project-shell-view</div>,
}));

vi.mock("./pages/LoginPage/LoginPage", () => ({
  LoginPage: () => <div>login-view</div>,
}));

vi.mock("./pages/SignupPage/SignupPage", () => ({
  SignupPage: () => <div>signup-view</div>,
}));

vi.mock("./pages/DashboardPage/DashboardPage", () => ({
  DashboardPage: () => <div>dashboard-view</div>,
}));

vi.mock("./pages/SettingsPage/SettingsPage", () => ({
  SettingsPage: () => <div>settings-view</div>,
}));

const mockFetchCurrentUser = vi.fn();
const mockClearAuthToken = vi.fn();

vi.mock("./api/auth", () => ({
  getAuthToken: () => localStorage.getItem("aegis:authToken"),
  clearAuthToken: (...args: unknown[]) => mockClearAuthToken(...args),
  fetchCurrentUser: (...args: unknown[]) => mockFetchCurrentUser(...args),
  login: vi.fn(),
  logout: vi.fn(),
}));

describe("App auth routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("lands on login when there is no stored auth state", async () => {
    render(<App />);

    expect(await screen.findByText("login-view")).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
  });

  it("redirects authenticated root sessions to dashboard", async () => {
    localStorage.setItem("aegis:authToken", "mock-token");
    mockFetchCurrentUser.mockResolvedValue({
      id: "mock-user",
      username: "operator@example.com",
      displayName: "operator",
      role: "admin",
      createdAt: "2026-04-13T00:00:00Z",
      updatedAt: "2026-04-13T00:00:00Z",
    });

    render(<App />);

    expect(await screen.findByText("dashboard-view")).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/dashboard"));
  });
});
