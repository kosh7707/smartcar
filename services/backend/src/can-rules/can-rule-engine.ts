import type { CanMessage } from "@smartcar/shared";
import type { CanAnalysisRule, CanRuleMatch } from "./types";

export class CanRuleEngine {
  private rules: CanAnalysisRule[] = [];

  registerRule(rule: CanAnalysisRule): void {
    if (!this.rules.find((r) => r.id === rule.id)) {
      this.rules.push(rule);
    }
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  evaluateMessage(message: CanMessage, recentMessages: CanMessage[]): CanRuleMatch[] {
    const results: CanRuleMatch[] = [];
    for (const rule of this.rules) {
      const match = rule.evaluate(message, recentMessages);
      if (match) results.push(match);
    }
    return results;
  }

  resetAll(): void {
    for (const rule of this.rules) rule.reset();
  }

  getRules(): CanAnalysisRule[] {
    return [...this.rules];
  }
}
