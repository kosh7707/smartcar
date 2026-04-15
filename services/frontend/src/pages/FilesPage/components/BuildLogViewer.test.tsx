import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BuildLogViewer } from "./BuildLogViewer";

const mockFetchBuildLog = vi.fn();
const mockLogError = vi.fn();

vi.mock("../../../api/pipeline", () => ({
  fetchBuildLog: (...args: unknown[]) => mockFetchBuildLog(...args),
}));

vi.mock("../../../api/core", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

describe("BuildLogViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBuildLog.mockResolvedValue({
      buildLog: "gcc -Wall main.c\nBuild succeeded",
      status: "success",
      updatedAt: "2026-04-15T00:00:00Z",
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("fetches and renders the selected target build log", async () => {
    render(
      <BuildLogViewer
        projectId="project-1"
        targetId="target-1"
        targetName="gateway"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("로그 불러오는 중...");
    await waitFor(() => expect(mockFetchBuildLog).toHaveBeenCalledWith("project-1", "target-1"));
    expect(await screen.findByText(/gcc -Wall main\.c/)).toBeInTheDocument();
    expect(screen.getByText("(success)")).toBeInTheDocument();
  });

  it("keeps close behavior scoped to the close button and backdrop", async () => {
    const onClose = vi.fn();
    render(
      <BuildLogViewer
        projectId="project-1"
        targetId="target-1"
        targetName="gateway"
        onClose={onClose}
      />,
    );

    await screen.findByText(/Build succeeded/);

    fireEvent.click(screen.getByText(/Build succeeded/));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    fireEvent.click(document.querySelector(".build-log-overlay")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("copies the visible log without closing the viewer", async () => {
    const onClose = vi.fn();
    render(
      <BuildLogViewer
        projectId="project-1"
        targetId="target-1"
        targetName="gateway"
        onClose={onClose}
      />,
    );

    await screen.findByText(/Build succeeded/);
    fireEvent.click(screen.getByRole("button", { name: "복사" }));

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("gcc -Wall main.c\nBuild succeeded"),
    );
    expect(await screen.findByRole("button", { name: "복사됨" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows an empty state and logs fetch failures", async () => {
    const error = new Error("log unavailable");
    mockFetchBuildLog.mockRejectedValue(error);

    render(
      <BuildLogViewer
        projectId="project-1"
        targetId="target-1"
        targetName="gateway"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("빌드 로그가 없습니다")).toBeInTheDocument();
    expect(mockLogError).toHaveBeenCalledWith("fetchBuildLog", error);
  });
});
