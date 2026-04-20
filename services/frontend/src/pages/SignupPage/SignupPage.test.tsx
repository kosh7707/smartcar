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

  it("renders the imported onboarding template surface", () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "회원가입" })).toBeInTheDocument();
    expect(screen.getByText("가입은 승인제로 운영됩니다.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /계정 하나로/ })).toBeInTheDocument();
    expect(screen.getByText("조직 · 접근 범위")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인으로" })).toBeInTheDocument();
    expect(screen.getByLabelText("이름")).toBeInTheDocument();
    expect(screen.getByLabelText("업무용 이메일")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호", { selector: "input" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ACME-KR-SEC")).toBeInTheDocument();
    expect(document.title).toBe("AEGIS — 가입 요청");
  });

  it("submits and shows an awaiting-approval completion state", async () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "홍길동" } });
    fireEvent.change(screen.getByLabelText("업무용 이메일"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호", { selector: "input" }), { target: { value: "Secret123!" } });
    fireEvent.change(screen.getByPlaceholderText("ACME-KR-SEC"), { target: { value: "ACME-KR-SEC" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /서비스 이용 약관/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /계정 활동은 감사 목적/ }));
    fireEvent.click(screen.getByRole("button", { name: "가입 요청 제출" }));

    expect(await screen.findByRole("button", { name: "요청 제출 중..." })).toBeDisabled();
    expect(await screen.findByText("가입 요청이 제출되었습니다.")).toBeInTheDocument();
    expect(screen.getByText("관리자 승인 후 초대 링크와 후속 안내가 전달됩니다.")).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps submit disabled until the required mock fields are filled", () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "가입 요청 제출" })).toBeDisabled();
  });

  it("updates password strength and toggles password visibility", () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    const passwordInput = screen.getByLabelText("비밀번호", { selector: "input" }) as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: "Secret123!" } });

    expect(screen.getByText("strength=strong")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "가입 비밀번호 보기" }));
    expect(passwordInput.type).toBe("text");
  });

  it("verifies a mock org code and updates the org panel", async () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("ACME-KR-SEC"), { target: { value: "ACME-KR-SEC" } });
    fireEvent.click(screen.getByRole("button", { name: "조직 코드 검증" }));

    await waitFor(() => expect(screen.getByText("verified · pending approval")).toBeInTheDocument());
    expect(screen.getByText("승인 대기 조직")).toBeInTheDocument();
    expect(screen.getByText("승인 후 공개")).toBeInTheDocument();
  });

  it("allows starting a new request again after submission", async () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "홍길동" } });
    fireEvent.change(screen.getByLabelText("업무용 이메일"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호", { selector: "input" }), { target: { value: "Secret123!" } });
    fireEvent.change(screen.getByPlaceholderText("ACME-KR-SEC"), { target: { value: "ACME-KR-SEC" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /서비스 이용 약관/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /계정 활동은 감사 목적/ }));
    fireEvent.click(screen.getByRole("button", { name: "가입 요청 제출" }));

    await screen.findByText("가입 요청이 제출되었습니다.");
    fireEvent.click(screen.getByRole("button", { name: "다시 요청 작성" }));

    expect(screen.getByRole("button", { name: "가입 요청 제출" })).toBeInTheDocument();
  });

  it("navigates back to login from the top back button", () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "로그인으로" }));

    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
