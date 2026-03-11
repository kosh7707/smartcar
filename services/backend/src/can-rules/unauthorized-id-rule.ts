import type { CanMessage } from "@smartcar/shared";
import type { CanAnalysisRule, CanRuleMatch } from "./types";

const DEFAULT_ALLOWED_IDS = new Set([
  "0x000", "0x001", "0x002",
  "0x100", "0x101", "0x102",
  "0x200", "0x201", "0x202",
  "0x300", "0x301", "0x302",
  "0x400", "0x401", "0x402",
  "0x500", "0x501", "0x502",
  "0x600", "0x601", "0x602",
  "0x700", "0x701", "0x702",
  "0x7DF",
  "0x7E0", "0x7E1", "0x7E2", "0x7E3",
  "0x7E4", "0x7E5", "0x7E6", "0x7E7",
  "0x7E8", "0x7E9", "0x7EA", "0x7EB",
  "0x7EC", "0x7ED", "0x7EE", "0x7EF",
]);

export class UnauthorizedIdRule implements CanAnalysisRule {
  id = "CAN-UNAUTH";
  name = "Unauthorized CAN ID Detection";
  severity = "medium" as const;

  private allowedIds: Set<string>;
  private alreadyDetected = new Set<string>();

  constructor(allowedIds?: Set<string>) {
    this.allowedIds = allowedIds ?? DEFAULT_ALLOWED_IDS;
  }

  evaluate(message: CanMessage, _recentMessages: CanMessage[]): CanRuleMatch | null {
    if (this.allowedIds.has(message.id)) return null;
    if (this.alreadyDetected.has(message.id)) return null;

    this.alreadyDetected.add(message.id);
    return {
      ruleId: this.id,
      severity: this.severity,
      title: `Unauthorized CAN ID: ${message.id}`,
      description: `허용 목록에 없는 CAN ID ${message.id}가 감지되었습니다. 비인가 ECU 또는 공격자의 메시지일 수 있습니다.`,
      relatedMessages: [message],
    };
  }

  reset(): void {
    this.alreadyDetected.clear();
  }
}
