import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBackendUrl, setBackendUrl, getWsBaseUrl, ApiError, logError, healthFetch, apiFetch } from "./core";

describe("getBackendUrl", () => {
  beforeEach(() => localStorage.clear());

  it("returns default when no storage or window.api", () => {
    expect(getBackendUrl()).toBe("http://localhost:3000");
  });

  it("returns stored value from localStorage", () => {
    localStorage.setItem("aegis:backendUrl", "http://custom:4000");
    expect(getBackendUrl()).toBe("http://custom:4000");
  });
});

describe("setBackendUrl", () => {
  beforeEach(() => localStorage.clear());

  it("stores trimmed URL", () => {
    setBackendUrl("  http://test:5000  ");
    expect(localStorage.getItem("aegis:backendUrl")).toBe("http://test:5000");
  });

  it("removes key for empty string", () => {
    localStorage.setItem("aegis:backendUrl", "http://test");
    setBackendUrl("");
    expect(localStorage.getItem("aegis:backendUrl")).toBeNull();
  });

  it("removes key for whitespace-only string", () => {
    localStorage.setItem("aegis:backendUrl", "http://test");
    setBackendUrl("   ");
    expect(localStorage.getItem("aegis:backendUrl")).toBeNull();
  });
});

describe("getWsBaseUrl", () => {
  beforeEach(() => localStorage.clear());

  it("converts http to ws", () => {
    expect(getWsBaseUrl()).toBe("ws://localhost:3000");
  });

  it("converts https to wss", () => {
    localStorage.setItem("aegis:backendUrl", "https://secure:3000");
    expect(getWsBaseUrl()).toBe("wss://secure:3000");
  });
});

describe("ApiError", () => {
  it("has correct properties", () => {
    const err = new ApiError("msg", "NOT_FOUND", false, "req-1");
    expect(err.message).toBe("msg");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.retryable).toBe(false);
    expect(err.requestId).toBe("req-1");
    expect(err.name).toBe("ApiError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("logError", () => {
  it("logs with requestId for ApiError", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new ApiError("fail", "DB_ERROR", true, "req-42");
    logError("Test", err);
    expect(spy).toHaveBeenCalledWith("[Test] fail (requestId: req-42)");
    spy.mockRestore();
  });

  it("logs without requestId for plain Error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("Test", new Error("oops"));
    expect(spy).toHaveBeenCalledWith("[Test]", "oops", expect.any(Error));
    spy.mockRestore();
  });

  it("logs string errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("Test", "raw string");
    expect(spy).toHaveBeenCalledWith("[Test]", "raw string", "raw string");
    spy.mockRestore();
  });
});

describe("healthFetch", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns ok false for empty URL", async () => {
    expect(await healthFetch("")).toEqual({ ok: false });
    expect(await healthFetch("   ")).toEqual({ ok: false });
  });

  it("returns ok true for healthy endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "ok" })));
    const result = await healthFetch("http://localhost:3000");
    expect(result.ok).toBe(true);
    expect(result.data?.status).toBe("ok");
  });

  it("returns ok false for degraded endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "degraded" })));
    const result = await healthFetch("http://localhost:3000");
    expect(result.ok).toBe(false);
  });

  it("returns ok false on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await healthFetch("http://localhost:3000");
    expect(result.ok).toBe(false);
  });

  it("trims trailing slashes from URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "ok" })));
    await healthFetch("http://localhost:3000///");
    expect(fetchSpy).toHaveBeenCalledWith("http://localhost:3000/health", expect.any(Object));
  });
});

describe("apiFetch", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("returns parsed JSON on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: 42 }), { status: 200 }));
    const result = await apiFetch<{ data: number }>("/test");
    expect(result.data).toBe(42);
  });

  it("attaches X-Request-Id header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({})));
    await apiFetch("/test");
    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Request-Id"]).toBeDefined();
  });

  it("throws ApiError on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiFetch("/fail")).rejects.toThrow(ApiError);
    try { await apiFetch("/fail"); } catch (e) {
      expect((e as ApiError).code).toBe("NETWORK_ERROR");
      expect((e as ApiError).retryable).toBe(true);
    }
  });

  it("throws ApiError with errorDetail from response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ errorDetail: { code: "NOT_FOUND", retryable: false, message: "missing" } }),
      { status: 404 },
    ));
    await expect(apiFetch("/notfound")).rejects.toThrow(ApiError);
  });

  it("throws PARSE_ERROR on invalid JSON response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not json", { status: 200, headers: { "Content-Type": "text/plain" } }));
    await expect(apiFetch("/bad")).rejects.toThrow(ApiError);
    try { await apiFetch("/bad"); } catch (e) {
      expect((e as ApiError).code).toBe("PARSE_ERROR");
    }
  });

  it("handles non-JSON error response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const nonJsonResponse = new Response("Internal Server Error", { status: 500 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(nonJsonResponse);
    try { await apiFetch("/error"); } catch (e) {
      expect((e as ApiError).message).toContain("내부 오류");
    }
  });
});
