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
const mockRegisterSdkByPath = vi.fn();
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
  registerSdkByPath: (...args: unknown[]) => mockRegisterSdkByPath(...args),
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
    mockRegisterSdkByPath.mockResolvedValue({
      id: "sdk-1",
      projectId: "p-1",
      name: "SDK One",
      description: "Cross compile SDK",
      path: "/opt/sdk-one",
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

  it("limits SDK registration UX to localPath and explains the contract", async () => {
    renderPage();

    await waitFor(() => expect(mockFetchProjectSdks).toHaveBeenCalledWith("p-1"));
    fireEvent.click(screen.getByRole("button", { name: /sdk 추가/i }));

    expect(screen.getByText(/localPath/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /파일 업로드/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("로컬 경로")).toBeInTheDocument();
  });

  it("appends the RegisteredSdk returned by path registration", async () => {
    renderPage();

    await waitFor(() => expect(mockFetchProjectSdks).toHaveBeenCalledWith("p-1"));
    fireEvent.click(screen.getByRole("button", { name: /sdk 추가/i }));
    fireEvent.change(screen.getByLabelText("SDK 이름"), { target: { value: "SDK One" } });
    fireEvent.change(screen.getByLabelText("설명 \(선택\)"), { target: { value: "Cross compile SDK" } });
    fireEvent.change(screen.getByLabelText("로컬 경로"), { target: { value: "/opt/sdk-one" } });

    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => {
      expect(mockRegisterSdkByPath).toHaveBeenCalledWith("p-1", "SDK One", "/opt/sdk-one", "Cross compile SDK");
    });
    expect(await screen.findByText("SDK One")).toBeInTheDocument();
    expect(screen.getByText("Cross compile SDK")).toBeInTheDocument();
    expect(screen.getByText("/opt/sdk-one")).toBeInTheDocument();
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

    await waitFor(() => expect(screen.getByText("SDK One")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /분석된 프로파일/i }));

    expect(await screen.findByText("/opt/sdk-one/environment-setup")).toBeInTheDocument();
  });
});
