import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SignupPage } from "./SignupPage";

const mockNavigate = vi.fn();
const mockLogin = vi.fn();
const mockVerifyOrgCode = vi.fn();
const mockRegister = vi.fn();

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

vi.mock("../../api/auth", () => ({
  verifyOrgCode: (...args: unknown[]) => mockVerifyOrgCode(...args),
  register: (...args: unknown[]) => mockRegister(...args),
}));

const ORG_PREVIEW = {
  orgId: "org-1",
  code: "ACME-KR-SEC",
  name: "ACME 코리아",
  admin: { displayName: "김관리", email: "admin@acme.kr" },
  region: "kr-seoul-1",
  defaultRole: "analyst" as const,
  emailDomainHint: "acme.kr",
};

const REG_CREATED = {
  registrationId: "reg-1",
  lookupToken: "lookup-1",
  lookupExpiresAt: "2026-04-27T00:00:00Z",
  status: "pending_admin_review" as const,
  createdAt: "2026-04-20T08:00:00Z",
};

async function fillAllFields() {
  fireEvent.change(screen.getByLabelText("이름"), { target: { value: "홍길동" } });
  fireEvent.change(screen.getByLabelText("업무용 이메일"), { target: { value: "user@example.com" } });
  fireEvent.change(screen.getByPlaceholderText("최소 8자 · 대소문자 · 숫자 · 특수문자"), { target: { value: "Secret123!" } });
  fireEvent.change(screen.getByPlaceholderText("ACME-KR-SEC"), { target: { value: "ACME-KR-SEC" } });
  fireEvent.click(screen.getByRole("button", { name: "조직 코드 검증" }));
  await screen.findByText("verified · pending approval");
  fireEvent.click(screen.getByRole("checkbox", { name: /서비스 이용 약관/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /계정 활동은 감사 목적/ }));
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
    mockVerifyOrgCode.mockResolvedValue(ORG_PREVIEW);
    mockRegister.mockResolvedValue(REG_CREATED);
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
    expect(screen.getByRole("button", { name: /로그인으로/ })).toBeInTheDocument();
    expect(screen.getByLabelText("이름")).toBeInTheDocument();
    expect(screen.getByLabelText("업무용 이메일")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("최소 8자 · 대소문자 · 숫자 · 특수문자")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ACME-KR-SEC")).toBeInTheDocument();
    expect(document.title).toBe("AEGIS — 가입 요청");
  });

  it("submits and shows an awaiting-approval completion state", async () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await fillAllFields();
    fireEvent.click(screen.getByRole("button", { name: "가입 요청 제출" }));

    expect(await screen.findByText("가입 요청이 제출되었습니다.")).toBeInTheDocument();
    expect(screen.getByText(/조직 관리자의 승인을 기다리세요/)).toBeInTheDocument();
    expect(screen.getByText(REG_CREATED.registrationId)).toBeInTheDocument();
    expect(screen.getByText(REG_CREATED.lookupToken)).toBeInTheDocument();
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({
      fullName: "홍길동",
      email: "user@example.com",
      password: "Secret123!",
      orgCode: "ACME-KR-SEC",
    }));
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

    const passwordInput = screen.getByPlaceholderText("최소 8자 · 대소문자 · 숫자 · 특수문자") as HTMLInputElement;
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
    expect(screen.getByText(ORG_PREVIEW.name)).toBeInTheDocument();
    expect(screen.getByText(`${ORG_PREVIEW.admin.displayName} · ${ORG_PREVIEW.admin.email}`)).toBeInTheDocument();
    expect(mockVerifyOrgCode).toHaveBeenCalledWith("ACME-KR-SEC");
  });

  it("allows starting a new request again after submission", async () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await fillAllFields();
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

    fireEvent.click(screen.getByRole("button", { name: /로그인으로/ }));

    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
