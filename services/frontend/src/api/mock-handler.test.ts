import { describe, expect, it } from "vitest";
import { mockApiFetch } from "./mock-handler";

describe("mockApiFetch", () => {
  it("filters project activity by project id", async () => {
    const response = await mockApiFetch<{ success: boolean; data: Array<{ metadata: { projectId: string } }> }>(
      "/api/projects/p-1/activity?limit=10",
      { method: "GET" },
    );

    expect(response.success).toBe(true);
    expect(response.data).not.toHaveLength(0);
    expect(response.data.every((entry) => entry.metadata.projectId === "p-1")).toBe(true);
  });

  it("handles top-level file content requests for FileDetailPage", async () => {
    const response = await mockApiFetch<{ success: boolean; data: { path: string; content: string; language: string } }>(
      "/api/files/f-1/content",
      { method: "GET" },
    );

    expect(response.success).toBe(true);
    expect(response.data.path).toBe("src/main.c");
    expect(response.data.content).toContain("memcpy");
    expect(response.data.language).toBe("c");
  });
});
