import { describe, it, expect } from "vitest";
import { SDK_PROFILES, getSdkProfile } from "./sdkProfiles";

describe("SDK_PROFILES", () => {
  it("has 13 profiles (12 predefined + custom)", () => {
    expect(SDK_PROFILES).toHaveLength(13);
  });

  it("all profiles have required fields", () => {
    for (const p of SDK_PROFILES) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.vendor).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.defaults).toBeDefined();
      expect(p.defaults.compiler).toBeDefined();
      expect(p.defaults.targetArch).toBeDefined();
      expect(p.defaults.languageStandard).toBeTruthy();
      expect(p.defaults.headerLanguage).toMatch(/^(c|cpp|auto)$/);
    }
  });

  it("has unique IDs", () => {
    const ids = SDK_PROFILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes custom profile", () => {
    const custom = SDK_PROFILES.find((p) => p.id === "custom");
    expect(custom).toBeDefined();
    expect(custom!.name).toContain("사용자");
  });
});

describe("getSdkProfile", () => {
  it("finds profile by ID", () => {
    const profile = getSdkProfile("nxp-s32k");
    expect(profile).toBeDefined();
    expect(profile!.vendor).toBe("NXP");
  });

  it("returns undefined for unknown ID", () => {
    expect(getSdkProfile("nonexistent")).toBeUndefined();
  });

  it("returns custom profile", () => {
    const custom = getSdkProfile("custom");
    expect(custom).toBeDefined();
    expect(custom!.defaults.compiler).toBe("");
  });
});
