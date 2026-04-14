import { describe, it, expect, beforeEach, vi } from "vitest";
import { getThemePreference, setThemePreference, applyTheme, isThemePreferenceEnabled } from "./theme";

describe("getThemePreference", () => {
  beforeEach(() => localStorage.clear());

  it("returns 'system' as default", () => {
    expect(getThemePreference()).toBe("system");
  });

  it("returns stored preference when it is supported", () => {
    localStorage.setItem("aegis:theme", "dark");
    expect(getThemePreference()).toBe("dark");
  });
});

describe("applyTheme", () => {
  it("sets data-theme to dark for dark preference", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("sets data-theme to light for light preference", () => {
    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("respects system preference when set to system", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    applyTheme("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: true });
    applyTheme("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("setThemePreference", () => {
  beforeEach(() => localStorage.clear());

  it("stores preference and applies theme", () => {
    setThemePreference("dark");
    expect(localStorage.getItem("aegis:theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("isThemePreferenceEnabled", () => {
  it("enables all declared theme modes", () => {
    expect(isThemePreferenceEnabled("light")).toBe(true);
    expect(isThemePreferenceEnabled("dark")).toBe(true);
    expect(isThemePreferenceEnabled("system")).toBe(true);
  });
});
