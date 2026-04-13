import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SettingsPage } from "./SettingsPage";

const mockGetBackendUrl = vi.fn();
const mockSetBackendUrl = vi.fn();
const mockHealthFetch = vi.fn();
const mockGetThemePreference = vi.fn();
const mockSetThemePreference = vi.fn();

vi.mock("../../api/client", () => ({
  getBackendUrl: () => mockGetBackendUrl(),
  setBackendUrl: (...args: unknown[]) => mockSetBackendUrl(...args),
  healthFetch: (...args: unknown[]) => mockHealthFetch(...args),
}));

vi.mock("../../utils/theme", () => ({
  getThemePreference: () => mockGetThemePreference(),
  setThemePreference: (...args: unknown[]) => mockSetThemePreference(...args),
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBackendUrl.mockReturnValue("http://localhost:3000");
    mockGetThemePreference.mockReturnValue("system");
    mockHealthFetch.mockResolvedValue({ ok: true, data: { service: "backend", version: "1.0.0" } });
  });

  it("saves a changed backend URL", () => {
    const { container } = render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "System Settings" })).toBeInTheDocument();
    expect(container.querySelector(".page-header--plain")).not.toBeNull();

    fireEvent.change(screen.getByPlaceholderText("http://localhost:3000"), { target: { value: "http://api.internal:4000" } });
    fireEvent.click(screen.getAllByRole("button", { name: "저장" })[0]);

    expect(mockSetBackendUrl).toHaveBeenCalledWith("http://api.internal:4000");
  });

  it("tests backend connectivity and shows success details", async () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "테스트" }));

    await waitFor(() => expect(mockHealthFetch).toHaveBeenCalledWith("http://localhost:3000"));
    expect(await screen.findByText(/연결 성공/)).toBeInTheDocument();
  });

  it("updates theme preference", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "라이트" }));

    expect(mockSetThemePreference).toHaveBeenCalledWith("light");
  });
});
