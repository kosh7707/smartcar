import type { Severity } from "@smartcar/shared";
import type { AnalysisRule, RuleMatch } from "./types";
import type { Rule } from "@smartcar/shared";

export class CustomRule implements AnalysisRule {
  id: string;
  name: string;
  severity: Severity;
  description: string;
  suggestion: string;
  private regex: RegExp;
  private fixCode?: string;

  constructor(stored: Rule) {
    this.id = stored.id;
    this.name = stored.name;
    this.severity = stored.severity;
    this.description = stored.description;
    this.suggestion = stored.suggestion;
    this.regex = new RegExp(stored.pattern);
    this.fixCode = stored.fixCode;
  }

  match(sourceCode: string, filename: string): RuleMatch[] {
    const results: RuleMatch[] = [];
    const lines = sourceCode.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("//") || line.startsWith("*")) continue;

      if (this.regex.test(line)) {
        results.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          title: this.name,
          description: this.description,
          suggestion: this.suggestion,
          location: `${filename}:${i + 1}`,
          fixCode: this.fixCode,
        });
      }
    }

    return results;
  }
}
