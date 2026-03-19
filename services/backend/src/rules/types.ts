import type { Severity } from "@aegis/shared";

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  title: string;
  description: string;
  suggestion: string;
  location: string;
  fixCode?: string;
}

export interface AnalysisRule {
  id: string;
  name: string;
  severity: Severity;
  description: string;
  suggestion: string;
  match(sourceCode: string, filename: string): RuleMatch[];
}
