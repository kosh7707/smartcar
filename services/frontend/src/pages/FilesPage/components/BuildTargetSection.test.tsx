import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { BuildTarget } from "@aegis/shared";
import { BuildTargetSection } from "./BuildTargetSection";

const mockUseBuildTargetSection = vi.fn();

vi.mock("../hooks/useBuildTargetSection", async () => {
  const actual = await vi.importActual<typeof import("../hooks/useBuildTargetSection")>("../hooks/useBuildTargetSection");
  return {
    ...actual,
    useBuildTargetSection: (...args: unknown[]) => mockUseBuildTargetSection(...args),
  };
});

vi.mock("./BuildProfileForm", () => ({ BuildProfileForm: () => <div>build-profile-form</div> }));
vi.mock("./BuildLogViewer", () => ({ BuildLogViewer: ({ targetName }: { targetName: string }) => <div>log-viewer:{targetName}</div> }));
vi.mock("./BuildTargetActionBar", () => ({ BuildTargetActionBar: () => <div>build-target-action-bar</div> }));
vi.mock("./BuildTargetRow", () => ({ BuildTargetRow: ({ target }: { target: BuildTarget }) => <div>build-target-row:{target.name}</div> }));
vi.mock("./BuildTargetSectionSummary", () => ({ BuildTargetSectionSummary: () => <div>build-target-section-summary</div> }));
vi.mock("./BuildTargetCreateDialog", () => ({ BuildTargetCreateDialog: () => <div>build-target-create-dialog</div> }));

const target: BuildTarget = {
  id: "target-1",
  projectId: "project-1",
  name: "gateway",
  relativePath: "src/gateway/",
  buildProfile: {
    sdkId: "none",
    compiler: "gcc",
    targetArch: "x86_64",
    languageStandard: "c17",
    headerLanguage: "auto",
  },
  sdkChoiceState: "sdk-none-explicit",
  status: "discovered",
  createdAt: "2026-04-10T00:00:00Z",
  updatedAt: "2026-04-10T00:00:00Z",
};

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    buildTargets: {
      loading: false,
      discovering: false,
      targets: [] as BuildTarget[],
    },
    pipeline: {
      connectionState: "connected",
      isRunning: false,
      readyCount: 0,
      failedCount: 0,
      totalCount: 0,
    },
    configuredCount: 0,
    formMode: null,
    formName: "",
    setFormName: vi.fn(),
    formPath: "",
    setFormPath: vi.fn(),
    formProfile: {
      sdkId: "none",
      compiler: "gcc",
      targetArch: "x86_64",
      languageStandard: "c17",
      headerLanguage: "auto",
    },
    setFormProfile: vi.fn(),
    saving: false,
    deleteTarget: null,
    setDeleteTarget: vi.fn(),
    logTarget: null,
    setLogTarget: vi.fn(),
    editingTarget: null,
    setEditingTarget: vi.fn(),
    readyTargets: [] as BuildTarget[],
    registeredSdks: [],
    sourceFiles: [],
    openAddForm: vi.fn(),
    closeForm: vi.fn(),
    handleSave: vi.fn(),
    handleDelete: vi.fn(),
    handleDiscover: vi.fn(),
    handleRunPipeline: vi.fn(),
    handleRetryTarget: vi.fn(),
    handleDeepAnalysis: vi.fn(),
    getTargetStatus: vi.fn(() => "discovered"),
    getTargetMessage: vi.fn(() => undefined),
    getTargetError: vi.fn(() => undefined),
    handleEditSubmit: vi.fn(),
    ...overrides,
  };
}

describe("BuildTargetSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading feedback while targets load", () => {
    mockUseBuildTargetSection.mockReturnValue(makeState({
      buildTargets: { loading: true, discovering: false, targets: [] },
    }));

    render(<BuildTargetSection projectId="project-1" />);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("shows the add form when formMode is add", () => {
    mockUseBuildTargetSection.mockReturnValue(makeState({
      formMode: "add",
      formName: "gateway",
      formPath: "src/gateway/",
    }));

    render(<BuildTargetSection projectId="project-1" />);
    expect(screen.getByText("타겟 이름")).toBeInTheDocument();
    expect(screen.getByText("상대 경로")).toBeInTheDocument();
    expect(screen.getByText("build-profile-form")).toBeInTheDocument();
  });

  it("renders rows, summary, log viewer, and edit dialog when state provides them", () => {
    mockUseBuildTargetSection.mockReturnValue(makeState({
      buildTargets: { loading: false, discovering: false, targets: [target] },
      logTarget: { id: "target-1", name: "gateway" },
      editingTarget: target,
    }));

    render(<BuildTargetSection projectId="project-1" />);
    expect(screen.getByText("build-target-row:gateway")).toBeInTheDocument();
    expect(screen.getByText("build-target-section-summary")).toBeInTheDocument();
    expect(screen.getByText("log-viewer:gateway")).toBeInTheDocument();
    expect(screen.getByText("build-target-create-dialog")).toBeInTheDocument();
  });
});
