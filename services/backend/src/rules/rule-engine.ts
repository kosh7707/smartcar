import type { AnalysisRule, RuleMatch } from "./types";

export class RuleEngine {
  private rules: AnalysisRule[] = [];
  private disabledIds = new Set<string>();

  registerRule(rule: AnalysisRule): void {
    if (!this.rules.find((r) => r.id === rule.id)) {
      this.rules.push(rule);
    }
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    this.disabledIds.delete(ruleId);
  }

  enableRule(ruleId: string): void {
    this.disabledIds.delete(ruleId);
  }

  disableRule(ruleId: string): void {
    this.disabledIds.add(ruleId);
  }

  isEnabled(ruleId: string): boolean {
    return !this.disabledIds.has(ruleId);
  }

  runAll(sourceCode: string, filename: string): RuleMatch[] {
    const results: RuleMatch[] = [];
    for (const rule of this.rules) {
      if (this.disabledIds.has(rule.id)) continue;
      results.push(...rule.match(sourceCode, filename));
    }
    return results;
  }

  getRules(): AnalysisRule[] {
    return [...this.rules];
  }
}
