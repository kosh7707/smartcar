import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";
import { ProjectSettingsPage } from "./ProjectSettingsPage";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;

  url: string;
  onmessage: ((evt: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = MockWebSocket.OPEN;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const mockFetchGateProfiles = vi.fn();
const mockFetchProjectSettings = vi.fn();
const mockUpdateProjectSettings = vi.fn();
const mockFetchProjectSdks = vi.fn();
const mockRegisterSdkByUpload = vi.fn();
const mockDeleteSdk = vi.fn();
const mockToast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };

vi.mock("../api/gate", () => ({
  fetchGateProfiles: (...args: unknown[]) => mockFetchGateProfiles(...args),
}));

vi.mock("../api/projects", () => ({
  fetchProjectSettings: (...args: unknown[]) => mockFetchProjectSettings(...args),
  updateProjectSettings: (...args: unknown[]) => mockUpdateProjectSettings(...args),
}));

vi.mock("../api/sdk", () => ({
  fetchProjectSdks: (...args: unknown[]) => mockFetchProjectSdks(...args),
  registerSdkByUpload: (...args: unknown[]) => mockRegisterSdkByUpload(...args),
  deleteSdk: (...args: unknown[]) => mockDeleteSdk(...args),
  getSdkWsUrl: vi.fn(() => "ws://localhost:3000/ws/sdk?projectId=p-1"),
}));

vi.mock("../api/core", () => ({ logError: vi.fn() }));
vi.mock("../contexts/ToastContext", () => ({ useToast: () => mockToast }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/p-1/settings"]}>
      <Routes>
        <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    mockFetchGateProfiles.mockResolvedValue([]);
    mockFetchProjectSettings.mockResolvedValue({ gateProfileId: "" });
    mockUpdateProjectSettings.mockResolvedValue(undefined);
    mockFetchProjectSdks.mockResolvedValue({ builtIn: [], registered: [] });
    mockRegisterSdkByUpload.mockResolvedValue({
      id: "sdk-1",
      projectId: "p-1",
      name: "SDK One",
      description: "Cross compile SDK",
      path: "/uploads/p-1/sdk/sdk-1",
      status: "uploading",
      verified: false,
      createdAt: "2026-04-04T00:00:00Z",
      updatedAt: "2026-04-04T00:00:00Z",
    });
    mockDeleteSdk.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders three upload mode tabs (archive, binary, folder)", async () => {
    renderPage();

    await waitFor(() => expect(mockFetchProjectSdks).toHaveBeenCalledWith("p-1"));
    fireEvent.click(screen.getByText("SDK Management"));
    fireEvent.click(screen.getByRole("button", { name: /sdk 추가/i }));

    expect(screen.getByRole("button", { name: /아카이브/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /바이너리/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /폴더/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("로컬 경로")).not.toBeInTheDocument();
  });

  it("shows SDK name and description fields in upload form", async () => {
    renderPage();

    await waitFor(() => expect(mockFetchProjectSdks).toHaveBeenCalledWith("p-1"));
    fireEvent.click(screen.getByText("SDK Management"));
    fireEvent.click(screen.getByRole("button", { name: /sdk 추가/i }));

    expect(screen.getByLabelText("SDK 이름")).toBeInTheDocument();
    expect(screen.getByLabelText("설명 (선택)")).toBeInTheDocument();
  });

  it("renders the canonical environmentSetup profile field", async () => {
    mockFetchProjectSdks.mockResolvedValue({
      builtIn: [],
      registered: [
        {
          id: "sdk-1",
          projectId: "p-1",
          name: "SDK One",
          path: "/opt/sdk-one",
          status: "ready",
          verified: true,
          createdAt: "2026-04-04T00:00:00Z",
          updatedAt: "2026-04-04T00:00:00Z",
          profile: {
            compiler: "arm-none-eabi-gcc",
            environmentSetup: "/opt/sdk-one/environment-setup",
          },
        },
      ],
    });

    renderPage();

    await waitFor(() => fireEvent.click(screen.getByText("SDK Management")));
    await waitFor(() => expect(screen.getByText("SDK One")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /분석된 프로파일/i }));

    expect(await screen.findByText("/opt/sdk-one/environment-setup")).toBeInTheDocument();
  });

  it("stepper renders 5 grouped phases for in-progress SDK", async () => {
    mockFetchProjectSdks.mockResolvedValue({
      builtIn: [],
      registered: [{
        id: "sdk-1",
        projectId: "p-1",
        name: "Test SDK",
        path: "/uploads/p-1/sdk/sdk-1",
        status: "extracting",
        verified: false,
        createdAt: "2026-04-04T00:00:00Z",
        updatedAt: "2026-04-04T00:00:00Z",
      }],
    });

    renderPage();

    await waitFor(() => fireEvent.click(screen.getByText("SDK Management")));
    await waitFor(() => expect(screen.getByText("Test SDK")).toBeInTheDocument());

    expect(screen.getByText("업로드")).toBeInTheDocument();
    expect(screen.getByText("설치/압축해제")).toBeInTheDocument();
    expect(screen.getByText("AI 분석")).toBeInTheDocument();
    expect(screen.getByText("검증")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
  });

  it("stepper shows Group 1 as done and Group 2 as active for extracting status", async () => {
    mockFetchProjectSdks.mockResolvedValue({
      builtIn: [],
      registered: [{
        id: "sdk-1",
        projectId: "p-1",
        name: "Test SDK",
        path: "/uploads/p-1/sdk/sdk-1",
        status: "extracting",
        verified: false,
        createdAt: "2026-04-04T00:00:00Z",
        updatedAt: "2026-04-04T00:00:00Z",
      }],
    });

    renderPage();

    await waitFor(() => fireEvent.click(screen.getByText("SDK Management")));
    await waitFor(() => expect(screen.getByText("Test SDK")).toBeInTheDocument());

    const uploadStep = screen.getByText("업로드").closest(".sdk-stepper__step");
    expect(uploadStep).toHaveClass("sdk-stepper__step--done");

    const extractStep = screen.getByText("설치/압축해제").closest(".sdk-stepper__step");
    expect(extractStep).toHaveClass("sdk-stepper__step--active");
  });

  it("install_failed marks Group 2 as failed and hides stepper", async () => {
    mockFetchProjectSdks.mockResolvedValue({
      builtIn: [],
      registered: [{
        id: "sdk-1",
        projectId: "p-1",
        name: "Test SDK",
        path: "/uploads/p-1/sdk/sdk-1",
        status: "install_failed",
        verifyError: "설치 실패",
        verified: false,
        createdAt: "2026-04-04T00:00:00Z",
        updatedAt: "2026-04-04T00:00:00Z",
      }],
    });

    renderPage();

    await waitFor(() => fireEvent.click(screen.getByText("SDK Management")));
    await waitFor(() => expect(screen.getByText("Test SDK")).toBeInTheDocument());

    expect(screen.queryByText("설치/압축해제")).not.toBeInTheDocument();
    expect(screen.getAllByText("설치 실패").length).toBeGreaterThan(0);
  });

  it("ready status shows all groups as done (no stepper rendered)", async () => {
    mockFetchProjectSdks.mockResolvedValue({
      builtIn: [],
      registered: [{
        id: "sdk-1",
        projectId: "p-1",
        name: "Test SDK",
        path: "/uploads/p-1/sdk/sdk-1",
        status: "ready",
        verified: false,
        createdAt: "2026-04-04T00:00:00Z",
        updatedAt: "2026-04-04T00:00:00Z",
      }],
    });

    renderPage();

    await waitFor(() => fireEvent.click(screen.getByText("SDK Management")));
    await waitFor(() => expect(screen.getByText("Test SDK")).toBeInTheDocument());

    expect(screen.queryByText("업로드")).not.toBeInTheDocument();
    expect(screen.getByText("사용 가능")).toBeInTheDocument();
  });
});
