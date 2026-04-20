import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Navbar } from "./Navbar";

const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();
const mockGetThemePreference = vi.fn();
const mockSetThemePreference = vi.fn();
const mockLogout = vi.fn();
const mockNavigate = vi.fn();

const mockNotificationContext = {
  notifications: [
    {
      id: "notif-1",
      projectId: "p-1",
      type: "sdk_ready",
      title: "SDK 등록 완료",
      body: "ARM SDK 사용 가능",
      read: false,
      createdAt: "2026-04-10T09:00:00Z",
      jobKind: "sdk",
    },
    {
      id: "notif-2",
      projectId: "p-1",
      type: "analysis_complete",
      title: "분석 완료",
      body: "정적 분석 완료",
      read: true,
      createdAt: "2026-04-10T10:00:00Z",
      jobKind: "analysis",
    },
  ],
  unreadCount: 1,
  loading: false,
  markRead: (...args: unknown[]) => mockMarkRead(...args),
  markAllRead: (...args: unknown[]) => mockMarkAllRead(...args),
  refresh: vi.fn(),
};

vi.mock("../contexts/NotificationContext", () => ({
  useNotifications: () => mockNotificationContext,
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u", username: "acme-admin", displayName: "ACME Security Admin", email: "admin@acme.kr", role: "admin", organizationName: "ACME Corp · Security Team", createdAt: "", updatedAt: "" },
    loading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: (...args: unknown[]) => mockLogout(...args),
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../utils/theme", () => ({
  getThemePreference: () => mockGetThemePreference(),
  setThemePreference: (...args: unknown[]) => mockSetThemePreference(...args),
  isThemePreferenceEnabled: () => true,
}));

describe("Navbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetThemePreference.mockReturnValue("system");
    mockMarkRead.mockResolvedValue(undefined);
    mockMarkAllRead.mockResolvedValue(undefined);
    mockLogout.mockResolvedValue(undefined);
  });

  it("keeps the global dashboard route label as 대시보드", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "대시보드" })).toHaveAttribute("href", "/dashboard");
  });

  it("shows unread badge and exposes notification dropdown actions", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/p-1/overview"]}>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /알림/i }));

    expect(screen.getByText("SDK 등록 완료")).toBeInTheDocument();
    expect(screen.getByText("ARM SDK 사용 가능")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "모두 읽음" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "읽음" }));
    expect(mockMarkRead).toHaveBeenCalledWith("notif-1");

    fireEvent.click(screen.getByRole("button", { name: "모두 읽음" }));
    expect(mockMarkAllRead).toHaveBeenCalled();
  });

  it("keeps the settings shortcut in the right action area", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "설정" })).toHaveAttribute("href", "/settings");
  });

  it("opens the user menu and logs out", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Navbar />
      </MemoryRouter>,
    );

    const userButton = screen.getByRole("button", { name: "계정 · ACME Security Admin" });
    fireEvent.click(userButton);

    const logoutButton = await screen.findByRole("button", { name: "로그아웃" });
    fireEvent.click(logoutButton);

    await screen.findByRole("button", { name: "계정 · ACME Security Admin" });
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("toggles between light and dark when clicking the theme button", () => {
    document.documentElement.setAttribute("data-theme", "light");

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Navbar />
      </MemoryRouter>,
    );

    const toggle = screen.getByRole("button", { name: /라이트로 전환|다크로 전환/ });
    expect(toggle).toHaveAttribute("aria-label", "현재 라이트 모드 · 다크로 전환");

    fireEvent.click(toggle);
    expect(mockSetThemePreference).toHaveBeenLastCalledWith("dark");

    document.documentElement.setAttribute("data-theme", "dark");
    fireEvent.click(screen.getByRole("button", { name: /라이트로 전환|다크로 전환/ }));
    expect(mockSetThemePreference).toHaveBeenLastCalledWith("light");
  });
});
