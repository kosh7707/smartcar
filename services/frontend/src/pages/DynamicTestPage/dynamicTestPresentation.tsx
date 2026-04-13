import React from "react";
import type { TestStrategy } from "@aegis/shared";
import { AlertTriangle, Bug, Clock, Zap } from "lucide-react";

export const STRATEGY_LABELS: Record<TestStrategy, string> = {
  random: "랜덤 퍼징",
  boundary: "경계값 분석",
  scenario: "공격 시나리오",
};

export const FINDING_TYPE_ICON: Record<string, React.ReactNode> = {
  crash: <Bug size={14} />,
  anomaly: <AlertTriangle size={14} />,
  timeout: <Clock size={14} />,
};

export const FINDING_TYPE_LABEL: Record<string, string> = {
  crash: "Crash",
  anomaly: "Anomaly",
  timeout: "Timeout",
};

export const TEST_TYPE_ICON = {
  fuzzing: <Zap size={16} />,
  pentest: <Bug size={16} />,
};
