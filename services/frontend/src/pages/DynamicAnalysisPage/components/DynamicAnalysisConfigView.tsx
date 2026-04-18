import React from "react";
import type { Adapter } from "@aegis/shared";
import { Plug, Radio } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  AdapterSelector,
  BackButton,
  PageHeader,
  Spinner,
} from "../../../shared/ui";

interface DynamicAnalysisConfigViewProps {
  projectId?: string;
  connected: Adapter[];
  selectedAdapterId: string | null;
  setSelectedAdapterId: (id: string | null) => void;
  creating: boolean;
  onBack: () => void;
  onStart: () => void;
}

export const DynamicAnalysisConfigView: React.FC<
  DynamicAnalysisConfigViewProps
> = ({
  projectId,
  connected,
  selectedAdapterId,
  setSelectedAdapterId,
  creating,
  onBack,
  onStart,
}) => (
  <div className="page-enter space-y-6">
    <BackButton onClick={onBack} label="이력으로" />
    <PageHeader title="새 세션" />

    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>모니터링 설정</CardTitle>
        <CardDescription>
          연결된 어댑터를 선택하고 실시간 CAN 트래픽 모니터링을 시작하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <Label className="text-sm font-semibold text-foreground">어댑터</Label>
          {connected.length === 0 ? (
            <Alert variant="destructive">
              <Plug size={16} />
              <AlertTitle>연결된 어댑터가 없습니다.</AlertTitle>
              <AlertDescription>
                <a
                  href={`#/projects/${projectId}/settings`}
                  className="font-medium underline underline-offset-4"
                >
                  프로젝트 설정
                </a>
                에서 연결해주세요.
              </AlertDescription>
            </Alert>
          ) : (
            <AdapterSelector
              adapters={connected}
              selectedId={selectedAdapterId}
              onSelect={setSelectedAdapterId}
              disabled={creating}
            />
          )}
        </section>

        <section className="space-y-3">
          <Label className="text-sm font-semibold text-foreground">
            모니터링 모드
          </Label>
          <Card size="sm" className="border border-border/70 bg-muted/20 shadow-none">
            <CardContent className="flex items-start gap-3 pt-3">
              <div className="mt-0.5 rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
                <Radio size={16} />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">실시간 CAN 트래픽 모니터링</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  어댑터를 통해 CAN 버스 트래픽을 실시간으로 수집하고, 이상
                  패턴을 탐지합니다. 세션 종료 시 수집된 메시지와 알림 이력이
                  저장됩니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="pt-2">
          <Button disabled={!selectedAdapterId || creating} onClick={onStart}>
            {creating ? <Spinner size={14} /> : <Plug size={16} />}
            모니터링 시작
          </Button>
        </div>
      </CardContent>
    </Card>

    {creating && (
      <div className="centered-loader--compact">
        <Spinner label="세션 생성 중..." />
      </div>
    )}
  </div>
);
