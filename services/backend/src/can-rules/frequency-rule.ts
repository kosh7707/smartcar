import type { CanMessage } from "@smartcar/shared";
import type { CanAnalysisRule, CanRuleMatch } from "./types";

const WINDOW_MS = 500;
const THRESHOLD = 10;

interface WindowState {
  count: number;
  windowStart: number;
  alerted: boolean;
}

export class FrequencyRule implements CanAnalysisRule {
  id = "CAN-FREQ";
  name = "High Frequency Message Detection";
  severity = "high" as const;

  private windows = new Map<string, WindowState>();

  evaluate(message: CanMessage, recentMessages: CanMessage[]): CanRuleMatch | null {
    const now = new Date(message.timestamp).getTime();
    let state = this.windows.get(message.id);

    if (!state || now - state.windowStart > WINDOW_MS) {
      state = { count: 0, windowStart: now, alerted: false };
      this.windows.set(message.id, state);
    }

    state.count++;

    if (state.count > THRESHOLD && !state.alerted) {
      state.alerted = true;
      const related = recentMessages.filter((m) => m.id === message.id).slice(-THRESHOLD);
      return {
        ruleId: this.id,
        severity: this.severity,
        title: `High frequency on ${message.id}`,
        description: `CAN ID ${message.id}의 메시지가 ${WINDOW_MS}ms 내에 ${state.count}건 수신되었습니다. DoS 공격 가능성이 있습니다.`,
        relatedMessages: related,
      };
    }

    return null;
  }

  reset(): void {
    this.windows.clear();
  }
}
