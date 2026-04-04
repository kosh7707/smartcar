import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch before importing client
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const storage: Record<string, string> = {};
Object.defineProperty(global, "localStorage", {
  value: {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => { storage[key] = value; },
    removeItem: (key: string) => { delete storage[key]; },
  },
});

import {
  fetchBuildTargets,
  createBuildTarget,
  deleteBuildTarget,
  discoverBuildTargets,
  runPipelineTarget,
  runAnalysis,
  generatePoc,
  fetchSourceFiles,
  fetchSourceFileContent,
} from "./client";

function mockResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    headers: new Headers(),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchBuildTargets", () => {
  it("calls GET /api/projects/:pid/targets", async () => {
    const targets = [{ id: "t-1", name: "gateway" }];
    mockResponse({ success: true, data: targets });

    const result = await fetchBuildTargets("proj-1");
    expect(result).toEqual(targets);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/projects/proj-1/targets");
  });
});

describe("createBuildTarget", () => {
  it("sends POST with name and relativePath", async () => {
    const created = { id: "t-2", name: "body", relativePath: "body/" };
    mockResponse({ success: true, data: created });

    const result = await createBuildTarget("proj-1", {
      name: "body",
      relativePath: "body/",
    });
    expect(result).toEqual(created);

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.name).toBe("body");
    expect(body.relativePath).toBe("body/");
  });
});

describe("deleteBuildTarget", () => {
  it("sends DELETE to correct URL", async () => {
    mockResponse({ success: true });

    await deleteBuildTarget("proj-1", "t-1");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/projects/proj-1/targets/t-1");
    expect(opts.method).toBe("DELETE");
  });
});

describe("discoverBuildTargets", () => {
  it("sends POST to discover endpoint", async () => {
    const discovered = [{ id: "t-3", name: "gateway" }];
    mockResponse({
      success: true,
      data: { discovered: 1, created: 1, targets: discovered, elapsedMs: 12 },
    });

    const result = await discoverBuildTargets("proj-1");
    expect(result).toEqual(discovered);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/projects/proj-1/targets/discover");
    expect(opts.method).toBe("POST");
  });
});

describe("runPipelineTarget", () => {
  it("uses the canonical targetId/status retry payload", async () => {
    mockResponse({ success: true, data: { targetId: "t-7", status: "running" } });

    const result = await runPipelineTarget("proj-1", "t-7");
    expect(result).toEqual({ targetId: "t-7", status: "running" });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/projects/proj-1/pipeline/run/t-7");
    expect(opts.method).toBe("POST");
  });
});

describe("runAnalysis", () => {
  it("sends projectId only when no targetIds", async () => {
    mockResponse({ success: true, data: { analysisId: "a-1", status: "running" } });

    const result = await runAnalysis("proj-1");
    expect(result.analysisId).toBe("a-1");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.projectId).toBe("proj-1");
    expect(body.targetIds).toBeUndefined();
  });

  it("includes targetIds when provided", async () => {
    mockResponse({ success: true, data: { analysisId: "a-2", status: "running" } });

    await runAnalysis("proj-1", ["t-1", "t-2"]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.targetIds).toEqual(["t-1", "t-2"]);
  });

  it("omits targetIds when empty array", async () => {
    mockResponse({ success: true, data: { analysisId: "a-3", status: "running" } });

    await runAnalysis("proj-1", []);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.targetIds).toBeUndefined();
  });
});

describe("generatePoc", () => {
  it("sends POST with projectId and findingId", async () => {
    const pocResult = {
      findingId: "f-1",
      poc: { statement: "PoC", detail: "```\ncode\n```" },
      audit: { latencyMs: 5000, tokenUsage: { prompt: 100, completion: 200 } },
    };
    mockResponse({ success: true, data: pocResult });

    const result = await generatePoc("proj-1", "f-1");
    expect(result.poc.statement).toBe("PoC");
    expect(result.audit.latencyMs).toBe(5000);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.projectId).toBe("proj-1");
    expect(body.findingId).toBe("f-1");
  });
});

describe("fetchSourceFiles", () => {
  it("calls GET source/files", async () => {
    const files = [{ relativePath: "main.c", size: 100, language: "c" }];
    mockResponse({ success: true, data: files });

    const result = await fetchSourceFiles("proj-1");
    expect(result).toEqual(files);
    expect(mockFetch.mock.calls[0][0]).toContain("/source/files");
  });
});

describe("fetchSourceFileContent", () => {
  it("encodes path in URL", async () => {
    mockResponse({ success: true, data: { path: "src/main.c", content: "code", language: "c", size: 100 } });

    await fetchSourceFileContent("proj-1", "src/main.c");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("path=src%2Fmain.c");
  });
});
