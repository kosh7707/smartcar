import React from "react";
import { AlertTriangle, Bell, Cable, FolderCog, Hammer, Package } from "lucide-react";

export type SettingsSection = "general" | "sdk" | "build-targets" | "notifications" | "adapters" | "danger";

const NAV_ITEMS: {
  id: SettingsSection;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "general", label: "일반", description: "프로젝트 이름과 설명", icon: FolderCog },
  { id: "sdk", label: "SDK 관리", description: "업로드와 프로파일 상태", icon: Package },
  { id: "build-targets", label: "빌드 타겟", description: "컴파일 타겟 준비", icon: Hammer },
  { id: "notifications", label: "알림", description: "프로젝트 이벤트 알림", icon: Bell },
  { id: "adapters", label: "어댑터", description: "동적 분석 연동", icon: Cable },
];

export const ProjectSettingsSidebar: React.FC = () => (
  <nav aria-label="프로젝트 설정 섹션" className="project-settings-sidebar-shell">
    <div className="panel project-settings-sidebar-card">
      <div className="panel-body">
        <div className="project-settings-sidebar-copy">
          <p className="project-settings-sidebar-eyebrow">워크스페이스 설정</p>
          <p className="project-settings-sidebar-text">프로젝트 운영 규칙과 SDK 준비 상태를 이곳에서 조정합니다.</p>
        </div>

        <div className="seg project-settings-sidebar-tabs" role="tablist" aria-label="프로젝트 설정 탭">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button type="button" role="tab" key={item.id} value={item.id} className="project-settings-sidebar-tab">
                <div className="project-settings-sidebar-tab-body">
                  <span className="project-settings-sidebar-tab-icon"><Icon className="size-4" /></span>
                  <span className="project-settings-sidebar-tab-copy">
                    <span className="project-settings-sidebar-tab-title">{item.label}</span>
                    <span className="project-settings-sidebar-tab-desc">{item.description}</span>
                  </span>
                </div>
              </button>
            );
          })}

          <div aria-hidden="true" className="project-settings-sidebar-divider" />

          <button type="button" role="tab" value="danger" className="project-settings-sidebar-tab project-settings-sidebar-tab--danger">
            <div className="project-settings-sidebar-tab-body">
              <span className="project-settings-sidebar-tab-icon"><AlertTriangle className="size-4" /></span>
              <span className="project-settings-sidebar-tab-copy">
                <span className="project-settings-sidebar-tab-title">위험 구역</span>
                <span className="project-settings-sidebar-tab-desc">되돌릴 수 없는 프로젝트 작업</span>
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </nav>
);
