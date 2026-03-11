import type { Severity, CanMessage } from "@smartcar/shared";

export interface CanRuleMatch {
  ruleId: string;
  severity: Severity;
  title: string;
  description: string;
  relatedMessages: CanMessage[];
}

export interface CanAnalysisRule {
  id: string;
  name: string;
  severity: Severity;
  evaluate(message: CanMessage, recentMessages: CanMessage[]): CanRuleMatch | null;
  reset(): void;
}
