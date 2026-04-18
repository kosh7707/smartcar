import React from "react";
import type { Adapter, TestStrategy } from "@aegis/shared";
import { AlertTriangle, Bug, Play, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { AdapterSelector, BackButton, PageHeader } from "../../../shared/ui";
import { STRATEGY_LABELS } from "../dynamicTestPresentation";

interface DynamicTestConfigViewProps {
  connected: Adapter[];
  selectedAdapterId: string;
  setSelectedAdapterId: (id: string) => void;
  testType: "fuzzing" | "pentest";
  setTestType: (type: "fuzzing" | "pentest") => void;
  strategy: TestStrategy;
  setStrategy: (strategy: TestStrategy) => void;
  targetEcu: string;
  setTargetEcu: (value: string) => void;
  targetId: string;
  setTargetId: (value: string) => void;
  count: number;
  setCount: (value: number) => void;
  hasEcuMeta: boolean;
  ecuMeta?: { name: string; canIds: string[] } | null;
  error: string | null;
  onBack: () => void;
  onStart: () => void;
}

const CONFIG_CARD_CLASS =
  "flex items-start gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm transition-colors";

export const DynamicTestConfigView: React.FC<DynamicTestConfigViewProps> = ({
  connected,
  selectedAdapterId,
  setSelectedAdapterId,
  testType,
  setTestType,
  strategy,
  setStrategy,
  targetEcu,
  setTargetEcu,
  targetId,
  setTargetId,
  count,
  setCount,
  hasEcuMeta,
  ecuMeta,
  error,
  onBack,
  onStart,
}) => {
  const selectClassName =
    "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="page-enter space-y-5">
      <BackButton onClick={onBack} label="이력으로" />
      <PageHeader
        title="새 세션"
        subtitle="연결된 어댑터와 전략을 선택해 동적 테스트 세션을 준비합니다."
      />

      <Card className="shadow-none">
        <CardContent className="space-y-6 p-5 sm:p-6">
          <section className="space-y-2">
            <p className="text-sm font-semibold text-foreground">어댑터</p>
            {connected.length === 0 ? (
              <Alert variant="destructive">
                <AlertTriangle size={16} />
                <AlertTitle>연결된 어댑터가 없습니다</AlertTitle>
                <AlertDescription>
                  프로젝트 설정에서 어댑터를 연결한 뒤 테스트를 시작하세요.
                </AlertDescription>
              </Alert>
            ) : (
              <AdapterSelector
                adapters={connected}
                selectedId={selectedAdapterId || null}
                onSelect={setSelectedAdapterId}
              />
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-foreground">테스트 유형</p>
            <RadioGroup
              value={testType}
              onValueChange={(value) => setTestType(value as "fuzzing" | "pentest")}
              className="grid gap-3 sm:grid-cols-2"
            >
              {[
                {
                  value: "fuzzing" as const,
                  icon: <Zap size={16} className="text-primary" />,
                  label: "퍼징 (Fuzzing)",
                  description: "랜덤·경계값 기반 입력으로 비정상 반응을 탐지합니다.",
                },
                {
                  value: "pentest" as const,
                  icon: <Bug size={16} className="text-primary" />,
                  label: "침투 테스트 (Pentest)",
                  description: "알려진 공격 벡터를 순차 실행합니다.",
                },
              ].map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`dynamic-test-type-${option.value}`}
                  className={cn(
                    CONFIG_CARD_CLASS,
                    "cursor-pointer",
                    testType === option.value &&
                      "border-primary/50 bg-primary/5 text-primary shadow-sm",
                  )}
                >
                  <RadioGroupItem
                    id={`dynamic-test-type-${option.value}`}
                    value={option.value}
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold text-foreground">대상 설정</p>
            {hasEcuMeta && ecuMeta ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Label className="flex flex-col items-start gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Target ECU</span>
                  <Input value={targetEcu} readOnly />
                </Label>
                <Label className="flex flex-col items-start gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Target ID</span>
                  <select
                    className={selectClassName}
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                  >
                    {ecuMeta.canIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </Label>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Label className="flex flex-col items-start gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Target ECU</span>
                  <Input
                    value={targetEcu}
                    onChange={(e) => setTargetEcu(e.target.value)}
                  />
                </Label>
                <Label className="flex flex-col items-start gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Target ID</span>
                  <Input
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    placeholder="0x100"
                  />
                </Label>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-foreground">전략</p>
            <RadioGroup
              value={strategy}
              onValueChange={(value) => setStrategy(value as TestStrategy)}
              className="grid gap-3 md:grid-cols-3"
            >
              {(["random", "boundary", "scenario"] as TestStrategy[]).map((value) => (
                <Label
                  key={value}
                  htmlFor={`dynamic-test-strategy-${value}`}
                  className={cn(
                    CONFIG_CARD_CLASS,
                    "cursor-pointer",
                    strategy === value &&
                      "border-primary/50 bg-primary/5 text-primary shadow-sm",
                  )}
                >
                  <RadioGroupItem
                    id={`dynamic-test-strategy-${value}`}
                    value={value}
                  />
                  <span className="font-medium text-foreground">
                    {STRATEGY_LABELS[value]}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </section>

          {strategy === "random" ? (
            <section className="space-y-2">
              <Label className="flex max-w-40 flex-col items-start gap-2">
                <span className="text-sm font-medium text-muted-foreground">입력 수</span>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={count}
                  onChange={(e) =>
                    setCount(Math.max(1, Math.min(1000, Number(e.target.value))))
                  }
                />
              </Label>
              <p className="text-sm text-muted-foreground">1 ~ 1,000</p>
            </section>
          ) : (
            <section className="space-y-2">
              <p className="text-sm text-muted-foreground">
                고정 입력 세트:{" "}
                {strategy === "boundary"
                  ? "12개 (경계값 + DLC 변형)"
                  : "20개 (DoS/진단/리플레이/파괴적)"}
              </p>
            </section>
          )}

          <section className="space-y-2">
            <p className="text-sm font-semibold text-foreground">요약</p>
            <Card className="border-primary/20 bg-primary/5 shadow-none">
              <CardContent className="flex items-start gap-3 p-4">
                {testType === "fuzzing" ? (
                  <Zap size={16} className="mt-0.5 shrink-0 text-primary" />
                ) : (
                  <Bug size={16} className="mt-0.5 shrink-0 text-primary" />
                )}
                <div className="space-y-1 text-sm">
                  <div className="font-medium text-foreground">
                    {testType === "fuzzing" ? "퍼징" : "침투 테스트"} —{" "}
                    {STRATEGY_LABELS[strategy]}
                  </div>
                  <p className="leading-6 text-muted-foreground">
                    {testType === "fuzzing"
                      ? strategy === "random"
                        ? `무작위 데이터 ${count}개를 생성하여 ${targetEcu}에 전송합니다. 예기치 않은 크래시나 이상 응답을 탐지합니다.`
                        : strategy === "boundary"
                          ? `경계값과 DLC 변형 12개를 ${targetEcu}에 전송하여 입력 검증 취약점을 탐지합니다.`
                          : `DoS, 진단, 리플레이 등 20개 공격 시나리오를 ${targetEcu}에 실행합니다.`
                      : `알려진 공격 벡터를 기반으로 ${targetEcu}의 보안 취약점을 능동적으로 탐지합니다.`}{" "}
                    프로토콜: CAN · 대상 ID: {targetId}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <div className="pt-1">
            <Button
              onClick={onStart}
              disabled={
                !targetEcu.trim() || !targetId.trim() || !selectedAdapterId
              }
            >
              <Play size={16} />
              테스트 시작
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle size={16} />
          <AlertTitle>테스트 시작 실패</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
