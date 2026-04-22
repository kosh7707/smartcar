import React from "react";

export type SettingsSection = "general" | "sdk" | "build-targets" | "notifications" | "adapters" | "danger";

interface PillEntry {
  id: SettingsSection;
  label: string;
  dot?: "critical" | "running" | "stale";
}

const TABS: PillEntry[] = [
  { id: "general",       label: "GENERAL" },
  { id: "sdk",           label: "SDKS" },
  { id: "build-targets", label: "TARGETS" },
  { id: "notifications", label: "NOTIFY" },
  { id: "adapters",      label: "ADAPTERS" },
  { id: "danger",        label: "DANGER", dot: "critical" },
];

const A11Y_LABEL: Record<SettingsSection, string> = {
  "general":       "일반",
  "sdk":           "SDK 관리",
  "build-targets": "빌드 타겟",
  "notifications": "알림",
  "adapters":      "어댑터",
  "danger":        "위험 구역",
};

interface ProjectSettingsSidebarProps {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
}

export const ProjectSettingsSidebar: React.FC<ProjectSettingsSidebarProps> = ({ active, onSelect }) => (
  <div className="filter-pills filter-pills--tabs" role="tablist" aria-label="프로젝트 설정 탭">
    {TABS.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={active === tab.id}
        aria-label={A11Y_LABEL[tab.id]}
        className={`pill${active === tab.id ? " active" : ""}`}
        onClick={() => onSelect(tab.id)}
      >
        {tab.dot ? <span className={`dot ${tab.dot}`} aria-hidden="true" /> : null}
        {tab.label}
      </button>
    ))}
  </div>
);
