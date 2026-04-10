import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectionStatusBanner } from "./ConnectionStatusBanner";

describe("ConnectionStatusBanner", () => {
  it("renders nothing when connected", () => {
    const { container } = render(<ConnectionStatusBanner connectionState="connected" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when disconnected (initial state)", () => {
    const { container } = render(<ConnectionStatusBanner connectionState="disconnected" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders reconnecting banner with retry count", () => {
    render(<ConnectionStatusBanner connectionState="reconnecting" retryCount={3} />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/재연결 중/)).toBeTruthy();
    expect(screen.getByText(/시도 3/)).toBeTruthy();
  });

  it("renders reconnecting banner without retry count", () => {
    render(<ConnectionStatusBanner connectionState="reconnecting" />);
    expect(screen.getByText(/재연결 중/)).toBeTruthy();
    expect(screen.queryByText(/시도/)).toBeNull();
  });

  it("renders failed banner with refresh button", () => {
    render(<ConnectionStatusBanner connectionState="failed" />);
    expect(screen.getByText(/연결 실패/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /새로고침/ })).toBeTruthy();
  });
});
