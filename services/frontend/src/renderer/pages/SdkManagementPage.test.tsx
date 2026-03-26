import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SdkManagementPage } from "./SdkManagementPage";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

const mockSdkList = {
  builtIn: [
    {
      id: "generic-linux",
      name: "Generic Linux",
      vendor: "Generic",
      description: "Standard GCC",
      defaults: { compiler: "gcc", targetArch: "x86_64", languageStandard: "c17", headerLanguage: "auto" },
    },
  ],
  registered: [
    {
      id: "sdk-1",
      projectId: "p-1",
      name: "TI AM335x",
      description: "TI SDK",
      path: "/sdks/ti",
      status: "ready",
      verified: true,
      profile: { compiler: "arm-gcc", targetArch: "armv7-a", gccVersion: "9.2.1" },
      createdAt: "2026-03-26T00:00:00Z",
      updatedAt: "2026-03-26T00:00:00Z",
    },
    {
      id: "sdk-2",
      projectId: "p-1",
      name: "NXP S32K",
      path: "/sdks/nxp",
      status: "analyzing",
      verified: false,
      createdAt: "2026-03-26T00:00:00Z",
      updatedAt: "2026-03-26T00:00:00Z",
    },
  ],
};

const mockFetchSdks = vi.fn();
const mockDeleteSdk = vi.fn();

vi.mock("../api/sdk", () => ({
  fetchProjectSdks: (...args: unknown[]) => mockFetchSdks(...args),
  deleteSdk: (...args: unknown[]) => mockDeleteSdk(...args),
  registerSdkByPath: vi.fn().mockResolvedValue({ sdkId: "sdk-new" }),
  registerSdkByUpload: vi.fn().mockResolvedValue({ sdkId: "sdk-new" }),
  getSdkWsUrl: () => "ws://localhost:3000/ws/sdk?projectId=p-1",
}));

vi.mock("../api/core", () => ({ logError: vi.fn() }));
vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));
vi.mock("../utils/wsEnvelope", () => ({
  createSeqTracker: () => ({ check: vi.fn(), reset: vi.fn() }),
}));

// Mock WebSocket
class MockWebSocket {
  onmessage: ((evt: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close() {}
}
vi.stubGlobal("WebSocket", MockWebSocket);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/p-1/sdk"]}>
      <Routes>
        <Route path="/projects/:projectId/sdk" element={<SdkManagementPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SdkManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSdks.mockResolvedValue(mockSdkList);
    mockDeleteSdk.mockResolvedValue(undefined);
  });

  it("renders built-in SDKs", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Generic Linux")).toBeInTheDocument());
    expect(screen.getByText("내장 SDK (1개)")).toBeInTheDocument();
  });

  it("renders registered SDKs", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("TI AM335x")).toBeInTheDocument());
    expect(screen.getByText("NXP S32K")).toBeInTheDocument();
    expect(screen.getByText("등록 SDK (2개)")).toBeInTheDocument();
  });

  it("shows status badge for registered SDK", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("사용 가능")).toBeInTheDocument());
    expect(screen.getByText("AI 분석 중")).toBeInTheDocument();
  });

  it("shows SDK add button", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Generic Linux"));
    expect(screen.getByText("SDK 추가")).toBeInTheDocument();
  });

  it("opens register form on click", async () => {
    renderPage();
    await waitFor(() => screen.getByText("SDK 추가"));
    fireEvent.click(screen.getByText("SDK 추가"));
    await waitFor(() => expect(screen.getByPlaceholderText("TI AM335x 08.02")).toBeInTheDocument());
  });

  it("has path and upload mode toggle", async () => {
    renderPage();
    await waitFor(() => screen.getByText("SDK 추가"));
    fireEvent.click(screen.getByText("SDK 추가"));
    await waitFor(() => {
      expect(screen.getAllByText("로컬 경로").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("파일 업로드").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows stepper for in-progress SDK", async () => {
    renderPage();
    await waitFor(() => screen.getByText("NXP S32K"));
    // Stepper shows step labels
    expect(screen.getByText("AI 분석")).toBeInTheDocument();
  });

  it("shows profile detail toggle for ready SDK", async () => {
    renderPage();
    await waitFor(() => screen.getByText("TI AM335x"));
    expect(screen.getByText("분석된 프로파일")).toBeInTheDocument();
  });

  it("shows empty state when no registered SDKs", async () => {
    mockFetchSdks.mockResolvedValue({ builtIn: mockSdkList.builtIn, registered: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText("등록된 SDK가 없습니다")).toBeInTheDocument());
  });
});
