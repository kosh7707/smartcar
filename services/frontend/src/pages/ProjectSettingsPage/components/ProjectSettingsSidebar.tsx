import React from "react";
import {
  AlertTriangle,
  Bell,
  Cable,
  FolderCog,
  Hammer,
  Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  <nav aria-label="프로젝트 설정 섹션" className="min-w-0">
    <Card className="sticky top-24 shadow-none">
      <CardContent className="space-y-4 p-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            워크스페이스 설정
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            프로젝트 운영 규칙과 SDK 준비 상태를 이곳에서 조정합니다.
          </p>
        </div>

        <TabsList
          variant="line"
          aria-label="프로젝트 설정 탭"
          className="h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="w-full justify-start rounded-xl border border-transparent px-3 py-3 text-left data-[active]:border-border data-[active]:bg-muted/60"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="rounded-lg border border-border bg-muted/60 p-2 text-muted-foreground data-[state=active]:text-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </div>
              </TabsTrigger>
            );
          })}

          <div aria-hidden="true" className="my-2 h-px bg-border" />

          <TabsTrigger
            value="danger"
            className={cn(
              "w-full justify-start rounded-xl border border-transparent px-3 py-3 text-left text-destructive data-[active]:border-destructive/30 data-[active]:bg-destructive/8 data-[active]:text-destructive",
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-destructive">
                <AlertTriangle className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">위험 구역</span>
                <span className="block text-xs text-destructive/80">
                  되돌릴 수 없는 프로젝트 작업
                </span>
              </span>
            </div>
          </TabsTrigger>
        </TabsList>
      </CardContent>
    </Card>
  </nav>
);
