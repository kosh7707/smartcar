import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "./LoginPage";

const mockNavigate = vi.fn();
const mockLogin = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/common/contexts/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
  });

  it("renders the imported console template surface", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === "임베디드 보안 분석을 한 곳에서")).toBeInTheDocument();
    expect(screen.getByText("AEGIS · PRODUCTION")).toBeInTheDocument();
    expect(screen.getByLabelText(/테마 전환/)).toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByText("이 기기에서 로그인 유지")).toBeInTheDocument();
    expect(document.title).toBe("AEGIS — 로그인");
  });

  it("logs in and navigates to dashboard on submit", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith("user@example.com", "secret", false));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows an inline error when login fails", async () => {
    mockLogin.mockRejectedValue(new Error("로그인 실패"));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByText("로그인 실패")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps submit disabled when required fields are blank", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "로그인" })).toBeDisabled();
  });

  it("toggles password visibility", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const passwordInput = screen.getByPlaceholderText("••••••••") as HTMLInputElement;
    const toggleButton = screen.getByRole("button", { name: "비밀번호 보기" });

    expect(passwordInput.type).toBe("password");
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe("text");
    expect(screen.getByRole("button", { name: "비밀번호 숨기기" })).toBeInTheDocument();
  });

  it("shows the submitting label while login is in flight", async () => {
    let resolveLogin: (() => void) | null = null;
    mockLogin.mockImplementation(() => new Promise<void>((resolve) => {
      resolveLogin = resolve;
    }));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("button", { name: "진입 중..." })).toBeDisabled();

    resolveLogin?.();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard"));
  });
});
