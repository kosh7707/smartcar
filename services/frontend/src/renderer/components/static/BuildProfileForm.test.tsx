import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { BuildProfile } from "@aegis/shared";
import { BuildProfileForm } from "./BuildProfileForm";
import type { RegisteredSdk } from "../../api/sdk";

const defaultProfile: BuildProfile = {
  sdkId: "none",
  compiler: "gcc",
  targetArch: "x86_64",
  languageStandard: "c17",
  headerLanguage: "auto",
};

const mockSdks: RegisteredSdk[] = [
  {
    id: "sdk-1",
    projectId: "p-1",
    name: "TI AM335x",
    path: "/sdks/ti",
    status: "ready",
    verified: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    profile: {
      compiler: "arm-none-eabi-gcc",
      targetArch: "arm",
      languageStandard: "c11",
    },
  },
  {
    id: "sdk-2",
    projectId: "p-1",
    name: "NXP S32K",
    path: "/sdks/nxp",
    status: "analyzing",
    verified: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

describe("BuildProfileForm", () => {
  it("renders SDK selector with '사용 안함' as default", () => {
    render(<BuildProfileForm value={defaultProfile} onChange={vi.fn()} />);
    const select = screen.getByLabelText("SDK 프로파일") as HTMLSelectElement;
    expect(select.value).toBe("none");
  });

  it("shows only ready SDKs in selector", () => {
    render(<BuildProfileForm value={defaultProfile} onChange={vi.fn()} registeredSdks={mockSdks} />);
    const select = screen.getByLabelText("SDK 프로파일") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.textContent);
    expect(options).toContain("사용 안함");
    expect(options).toContain("TI AM335x");
    // NXP S32K is status="analyzing", not "ready" → should not appear
    expect(options).not.toContain("NXP S32K");
  });

  it("calls onChange with SDK profile when SDK changes", () => {
    const onChange = vi.fn();
    render(<BuildProfileForm value={defaultProfile} onChange={onChange} registeredSdks={mockSdks} />);
    const select = screen.getByLabelText("SDK 프로파일");

    fireEvent.change(select, { target: { value: "sdk-1" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const newProfile = onChange.mock.calls[0][0];
    expect(newProfile.sdkId).toBe("sdk-1");
    expect(newProfile.compiler).toBe("arm-none-eabi-gcc");
    expect(newProfile.targetArch).toBe("arm");
  });

  it("shows hint when no SDKs registered", () => {
    render(<BuildProfileForm value={defaultProfile} onChange={vi.fn()} registeredSdks={[]} />);
    expect(screen.getByText(/등록된 SDK가 없습니다/)).toBeTruthy();
  });

  it("toggles advanced settings", () => {
    render(<BuildProfileForm value={defaultProfile} onChange={vi.fn()} />);

    // Advanced hidden by default
    expect(screen.queryByLabelText("컴파일러")).not.toBeInTheDocument();

    // Toggle open
    fireEvent.click(screen.getByText("상세 설정"));
    expect(screen.getByLabelText("컴파일러")).toBeInTheDocument();
    expect(screen.getByLabelText("타겟 아키텍처")).toBeInTheDocument();
  });

  it("updates compiler field", () => {
    const onChange = vi.fn();
    render(<BuildProfileForm value={defaultProfile} onChange={onChange} />);
    fireEvent.click(screen.getByText("상세 설정"));

    fireEvent.change(screen.getByLabelText("컴파일러"), { target: { value: "clang" } });
    expect(onChange).toHaveBeenCalledWith({ ...defaultProfile, compiler: "clang" });
  });

  it("parses include paths from newlines", () => {
    const onChange = vi.fn();
    render(<BuildProfileForm value={defaultProfile} onChange={onChange} />);
    fireEvent.click(screen.getByText("상세 설정"));

    const textarea = screen.getByLabelText(/인클루드 경로/);
    fireEvent.change(textarea, { target: { value: "../common/include\n../lib/include" } });

    const call = onChange.mock.calls[0][0];
    expect(call.includePaths).toEqual(["../common/include", "../lib/include"]);
  });

  it("parses defines as KEY=VALUE", () => {
    const onChange = vi.fn();
    render(<BuildProfileForm value={defaultProfile} onChange={onChange} />);
    fireEvent.click(screen.getByText("상세 설정"));

    const textarea = screen.getByLabelText(/전처리기 매크로/);
    fireEvent.change(textarea, { target: { value: "DEBUG=1\nVERSION=2.0" } });

    const call = onChange.mock.calls[0][0];
    expect(call.defines).toEqual({ DEBUG: "1", VERSION: "2.0" });
  });

  it("parses flags by whitespace", () => {
    const onChange = vi.fn();
    render(<BuildProfileForm value={defaultProfile} onChange={onChange} />);
    fireEvent.click(screen.getByText("상세 설정"));

    const textarea = screen.getByLabelText(/추가 컴파일 플래그/);
    fireEvent.change(textarea, { target: { value: "-Wall -Wextra -O2" } });

    const call = onChange.mock.calls[0][0];
    expect(call.flags).toEqual(["-Wall", "-Wextra", "-O2"]);
  });

  it("clears optional fields when empty", () => {
    const withPaths: BuildProfile = { ...defaultProfile, includePaths: ["/old"] };
    const onChange = vi.fn();
    render(<BuildProfileForm value={withPaths} onChange={onChange} />);
    fireEvent.click(screen.getByText("상세 설정"));

    const textarea = screen.getByLabelText(/인클루드 경로/);
    fireEvent.change(textarea, { target: { value: "" } });

    const call = onChange.mock.calls[0][0];
    expect(call.includePaths).toBeUndefined();
  });
});
