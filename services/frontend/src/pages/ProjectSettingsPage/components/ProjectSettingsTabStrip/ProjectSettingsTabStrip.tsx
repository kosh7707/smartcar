import "./ProjectSettingsTabStrip.css";
import React from "react";
import { AlertTriangle, Bell, Info, Package, Plug, Target } from "lucide-react";

export type SettingsSection = "general" | "sdk" | "build-targets" | "notifications" | "adapters" | "danger";

interface TabEntry {
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  soon?: boolean;
  danger?: boolean;
  ariaLabel: string;
}

const TABS: TabEntry[] = [
  { id: "general",       label: "일반",      icon: Info,           ariaLabel: "일반" },
  { id: "sdk",           label: "SDK 관리",  icon: Package,        ariaLabel: "SDK 관리" },
  { id: "build-targets", label: "빌드 타겟", icon: Target,  soon: true, ariaLabel: "빌드 타겟" },
  { id: "adapters",      label: "어댑터",    icon: Plug,    soon: true, ariaLabel: "어댑터" },
  { id: "notifications", label: "알림",      icon: Bell,    soon: true, ariaLabel: "알림" },
  { id: "danger",        label: "위험 구역", icon: AlertTriangle, danger: true, ariaLabel: "위험 구역" },
];

interface ProjectSettingsTabStripProps {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
}

export const ProjectSettingsTabStrip: React.FC<ProjectSettingsTabStripProps> = ({ active, onSelect }) => (
  <nav className="ps-tab-strip" role="tablist" aria-label="프로젝트 설정 탭">
    {TABS.map((tab) => {
      const Icon = tab.icon;
      const className = [
        "ps-tab",
        active === tab.id ? "ps-tab--active" : "",
        tab.soon ? "ps-tab--soon" : "",
        tab.danger ? "ps-tab--danger" : "",
      ].filter(Boolean).join(" ");
      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-label={tab.ariaLabel}
          data-section={tab.id}
          className={className}
          onClick={() => onSelect(tab.id)}
        >
          <Icon size={14} />
          <span className="ps-tab__label">{tab.label}</span>
          {tab.soon ? <span className="ps-tab__pill-soon" aria-label="준비 중">v0.2</span> : null}
        </button>
      );
    })}
  </nav>
);
