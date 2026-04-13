import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SignupPage } from "./SignupPage";

const mockNavigate = vi.fn();
const mockLogin = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin }),
}));

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
  });

  it("submits and navigates to projects on success", async () => {
    const { container } = render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "AEGIS" })).toBeInTheDocument();
    expect(container.querySelector(".page-header__eyebrow")).toHaveTextContent("회원가입");
    expect(screen.getByText("새 계정을 준비하고 분석 워크스페이스로 바로 이동합니다.")).toBeInTheDocument();
    expect(screen.getByText("필수 계정 정보를 먼저 입력합니다.")).toBeInTheDocument();
    expect(container.querySelector(".page-header--plain")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("사용자 이름"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "계정 만들기" }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith("user@example.com", "secret"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/projects"));
  });

  it("still navigates to projects when signup login stub rejects", async () => {
    mockLogin.mockRejectedValue(new Error("stub failure"));

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("사용자 이름"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "계정 만들기" }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/projects"));
  });
});
