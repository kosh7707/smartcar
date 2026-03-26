// Barrel re-export — backward-compatible with all existing imports.
// Domain-specific modules can be imported directly for clarity:
//   import { fetchProjects } from "../api/projects";
// Or via this barrel:
//   import { fetchProjects } from "../api/client";

export * from "./core";
export * from "./projects";
export * from "./source";
export * from "./analysis";
export * from "./pipeline";
export * from "./gate";
export * from "./approval";
export * from "./sdk";
export * from "./report";
export * from "./dynamic";
