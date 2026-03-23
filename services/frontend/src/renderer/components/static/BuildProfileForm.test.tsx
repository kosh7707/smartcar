import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { BuildProfile } from "@aegis/shared";
import { BuildProfileForm } from "./BuildProfileForm";
import { getSdkProfile } from "../../constants/sdkProfiles";

const defaultProfile: BuildProfile = {
  sdkId: "generic-linux",
  compiler: "gcc",
  targetArch: "x86_64",
  languageStandard: "c17",
  headerLanguage: "auto",
};

describe("BuildProfileForm", () => {
  it("renders SDK selector with current value", () => {
    render(<BuildProfileForm value={defaultProfile} onChange={vi.fn()} />);
    const select = screen.getByLabelText("SDK 프로파일") as HTMLSelectElement;
    expect(select.value).toBe("generic-linux");
  });

  it("calls onChange with SDK defaults when SDK changes", () => {
    const onChange = vi.fn();
    render(<BuildProfileForm value={defaultProfile} onChange={onChange} />);
    const select = screen.getByLabelText("SDK 프로파일");

    fireEvent.change(select, { target: { value: "nxp-s32k" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const newProfile = onChange.mock.calls[0][0];
    const nxpDefaults = getSdkProfile("nxp-s32k")!.defaults;
    expect(newProfile.sdkId).toBe("nxp-s32k");
    expect(newProfile.compiler).toBe(nxpDefaults.compiler);
    expect(newProfile.targetArch).toBe(nxpDefaults.targetArch);
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
