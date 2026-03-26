import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TargetLibraryPanel } from "./TargetLibraryPanel";
import React from "react";

const mockLibs = [
  {
    id: "lib-1",
    targetId: "t-1",
    projectId: "p-1",
    name: "civetweb",
    version: "1.16",
    path: "lib/civetweb/",
    included: false,
    modifiedFiles: ["civetweb.c"],
    createdAt: "2026-03-25T00:00:00Z",
    updatedAt: "2026-03-25T00:00:00Z",
  },
  {
    id: "lib-2",
    targetId: "t-1",
    projectId: "p-1",
    name: "mbedtls",
    path: "lib/mbedtls/",
    included: true,
    modifiedFiles: [],
    createdAt: "2026-03-25T00:00:00Z",
    updatedAt: "2026-03-25T00:00:00Z",
  },
];

const mockFetchLibs = vi.fn();
const mockUpdateLibs = vi.fn();

vi.mock("../../api/pipeline", () => ({
  fetchTargetLibraries: (...args: unknown[]) => mockFetchLibs(...args),
  updateTargetLibraries: (...args: unknown[]) => mockUpdateLibs(...args),
}));

vi.mock("../../api/core", () => ({
  logError: vi.fn(),
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  }),
}));

describe("TargetLibraryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchLibs.mockResolvedValue(mockLibs);
    mockUpdateLibs.mockResolvedValue(undefined);
  });

  it("renders library list after loading", async () => {
    render(<TargetLibraryPanel projectId="p-1" targetId="t-1" targetName="gateway" />);
    await waitFor(() => expect(screen.getByText("civetweb")).toBeInTheDocument());
    expect(screen.getByText("mbedtls")).toBeInTheDocument();
  });

  it("shows included count", async () => {
    render(<TargetLibraryPanel projectId="p-1" targetId="t-1" targetName="gateway" />);
    await waitFor(() => expect(screen.getByText("1/2개 포함")).toBeInTheDocument());
  });

  it("shows version badge", async () => {
    render(<TargetLibraryPanel projectId="p-1" targetId="t-1" targetName="gateway" />);
    await waitFor(() => expect(screen.getByText("1.16")).toBeInTheDocument());
  });

  it("shows modified files count", async () => {
    render(<TargetLibraryPanel projectId="p-1" targetId="t-1" targetName="gateway" />);
    await waitFor(() => expect(screen.getByText("수정 1개")).toBeInTheDocument());
  });

  it("shows path", async () => {
    render(<TargetLibraryPanel projectId="p-1" targetId="t-1" targetName="gateway" />);
    await waitFor(() => expect(screen.getByText("lib/civetweb/")).toBeInTheDocument());
  });

  it("toggle checkbox shows save button", async () => {
    render(<TargetLibraryPanel projectId="p-1" targetId="t-1" targetName="gateway" />);
    await waitFor(() => screen.getByText("civetweb"));
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // toggle civetweb
    expect(screen.getByText("설정 저장")).toBeInTheDocument();
  });

  it("save calls updateTargetLibraries", async () => {
    render(<TargetLibraryPanel projectId="p-1" targetId="t-1" targetName="gateway" />);
    await waitFor(() => screen.getByText("civetweb"));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByText("설정 저장"));
    await waitFor(() => expect(mockUpdateLibs).toHaveBeenCalledWith(
      "p-1", "t-1",
      expect.arrayContaining([
        expect.objectContaining({ id: "lib-1", included: true }),
      ]),
    ));
  });

  it("renders nothing when no libraries", async () => {
    mockFetchLibs.mockResolvedValue([]);
    const { container } = render(<TargetLibraryPanel projectId="p-1" targetId="t-1" targetName="gateway" />);
    await waitFor(() => expect(container.querySelector(".tlib")).toBeNull());
  });

  it("cancel reloads original data", async () => {
    render(<TargetLibraryPanel projectId="p-1" targetId="t-1" targetName="gateway" />);
    await waitFor(() => screen.getByText("civetweb"));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("취소")).toBeInTheDocument();
    fireEvent.click(screen.getByText("취소"));
    await waitFor(() => expect(mockFetchLibs).toHaveBeenCalledTimes(2));
  });
});
