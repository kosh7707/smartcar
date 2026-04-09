import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar, _resetHealthCache } from "./StatusBar";
import React from "react";

// Mock ToastContext
vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  }),
}));

// Mock NotificationContext
vi.mock("../contexts/NotificationContext", () => ({
  useNotifications: () => ({ unreadCount: 0, notifications: [], markAsRead: vi.fn() }),
}));

// Mock AuthContext
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { username: "test", role: "Admin" }, isLoggedIn: true, login: vi.fn(), logout: vi.fn() }),
}));

// Mock healthCheck
const mockHealthCheck = vi.fn();
vi.mock("../api/client", () => ({
  healthCheck: () => mockHealthCheck(),
}));

describe("StatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetHealthCache();
  });

  it("renders version string", async () => {
    mockHealthCheck.mockResolvedValue({ status: "ok" });
    render(<StatusBar />);
    expect(screen.getByText(/AEGIS v/)).toBeInTheDocument();
  });

  it("shows '확인 중' initially", () => {
    mockHealthCheck.mockResolvedValue({ status: "ok" });
    render(<StatusBar />);
    expect(screen.getByText("확인 중")).toBeInTheDocument();
  });

  it("has role=status for accessibility", () => {
    mockHealthCheck.mockResolvedValue({ status: "ok" });
    render(<StatusBar />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has aria-live=polite", () => {
    mockHealthCheck.mockResolvedValue({ status: "ok" });
    render(<StatusBar />);
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });
});
