import { afterEach, describe, expect, it, vi } from "vitest";
import { LlmTaskClient } from "../llm-task-client";

const originalFetch = globalThis.fetch;

function mockTaskSuccess() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      taskId: "task-1",
      taskType: "dynamic-annotate",
      status: "completed",
      modelProfile: "qwen",
      promptVersion: "v1",
      schemaVersion: "v1",
      validation: { valid: true, errors: [] },
      result: {
        summary: "ok",
        claims: [],
        caveats: [],
        usedEvidenceRefs: [],
        confidence: 0.8,
        confidenceBreakdown: {
          grounding: 1,
          deterministicSupport: 1,
          ragCoverage: 0.4,
          schemaCompliance: 1,
        },
        needsHumanReview: false,
        recommendedNextSteps: [],
        policyFlags: [],
      },
      audit: {
        inputHash: "sha256:test",
        latencyMs: 1,
        tokenUsage: { prompt: 1, completion: 1 },
        retryCount: 0,
        createdAt: "2026-05-02T00:00:00.000Z",
      },
    }),
    text: () => Promise.resolve(""),
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("LlmTaskClient", () => {
  it("fills S7 required caller-owned generation controls for /v1/tasks", async () => {
    globalThis.fetch = mockTaskSuccess();
    const client = new LlmTaskClient("http://localhost:8000");

    await client.submitTask({
      taskType: "dynamic-annotate",
      taskId: "task-1",
      context: { trusted: {}, untrusted: { rawCanLog: "can" } },
      evidenceRefs: [],
    }, "req-generation");

    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.constraints).toEqual(expect.objectContaining({
      enableThinking: true,
      maxTokens: 16384,
      temperature: 0.6,
      topP: 0.95,
      topK: 20,
      minP: 0,
      presencePenalty: 0,
      repetitionPenalty: 1,
    }));
    expect(opts.headers["X-Request-Id"]).toBe("req-generation");
  });

  it("preserves caller overrides while backfilling the rest of the generation tuple", async () => {
    globalThis.fetch = mockTaskSuccess();
    const client = new LlmTaskClient("http://localhost:8000");

    await client.submitTask({
      taskType: "test-plan-propose",
      taskId: "task-2",
      context: { trusted: {}, untrusted: { testResults: "results" } },
      evidenceRefs: [],
      constraints: {
        maxTokens: 4096,
        timeoutMs: 15000,
        outputSchema: "test-plan-v1",
      },
    });

    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.constraints).toEqual(expect.objectContaining({
      enableThinking: true,
      maxTokens: 4096,
      temperature: 0.6,
      topP: 0.95,
      timeoutMs: 15000,
      outputSchema: "test-plan-v1",
    }));
  });
});
