import React from "react";

export type SettingsSection = "general" | "sdk" | "build-targets" | "notifications" | "adapters" | "danger";

const NAV_ITEMS: { id: SettingsSection; label: string }[] = [
  { id: "general", label: "General" },
  { id: "sdk", label: "SDK Management" },
  { id: "build-targets", label: "빌드 타겟" },
  { id: "notifications", label: "알림" },
  { id: "adapters", label: "어댑터" },
];

interface ProjectSettingsSidebarProps {
  activeSection: SettingsSection;
  onSelect: (section: SettingsSection) => void;
}

export const ProjectSettingsSidebar: React.FC<ProjectSettingsSidebarProps> = ({ activeSection, onSelect }) => (
  <nav className="project-settings-sidebar">
    {NAV_ITEMS.map((item) => (
      <button
        key={item.id}
        className={`project-settings-sidebar__item${activeSection === item.id ? " project-settings-sidebar__item--active" : ""}`}
        onClick={() => onSelect(item.id)}
      >
        {item.label}
      </button>
    ))}

    <div className="project-settings-sidebar__divider" />

    <button
      className={`project-settings-sidebar__item project-settings-sidebar__item--danger${activeSection === "danger" ? " project-settings-sidebar__item--active project-settings-sidebar__item--danger-active" : ""}`}
      onClick={() => onSelect("danger")}
    >
      Danger Zone
    </button>
  </nav>
);
