import "./ProjectSettingsSidebar.css";
// Re-export from ProjectSettingsTabStrip — the previous filter-pills sidebar
// was superseded by the mock v2 horizontal tab strip. The type is kept here
// only for back-compat imports inside the page; new code should import from
// ProjectSettingsTabStrip directly.
export type { SettingsSection } from "../ProjectSettingsTabStrip/ProjectSettingsTabStrip";
