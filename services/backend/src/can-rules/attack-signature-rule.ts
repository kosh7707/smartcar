import type { CanMessage } from "@aegis/shared";
import type { CanAnalysisRule, CanRuleMatch } from "./types";

const DIAG_ID = "0x7DF";
const DIAG_WINDOW_MS = 200;
const DIAG_THRESHOLD = 5;
const REPLAY_THRESHOLD = 3;
const BUS_OFF_PAYLOAD = "FFFFFFFFFFFFFFFF";

export class AttackSignatureRule implements CanAnalysisRule {
  id = "CAN-SIG";
  name = "Known Attack Signature Detection";
  severity = "critical" as const;

  private diagCount = 0;
  private diagWindowStart = 0;
  private diagAlerted = false;

  evaluate(message: CanMessage, recentMessages: CanMessage[]): CanRuleMatch | null {
    return (
      this.detectDiagDos(message, recentMessages) ??
      this.detectReplay(message, recentMessages) ??
      this.detectBusOff(message, recentMessages)
    );
  }

  private detectDiagDos(message: CanMessage, recentMessages: CanMessage[]): CanRuleMatch | null {
    if (message.id !== DIAG_ID) return null;

    const now = new Date(message.timestamp).getTime();
    if (now - this.diagWindowStart > DIAG_WINDOW_MS) {
      this.diagCount = 0;
      this.diagWindowStart = now;
      this.diagAlerted = false;
    }
    this.diagCount++;

    if (this.diagCount > DIAG_THRESHOLD && !this.diagAlerted) {
      this.diagAlerted = true;
      const related = recentMessages.filter((m) => m.id === DIAG_ID).slice(-DIAG_THRESHOLD);
      return {
        ruleId: "CAN-SIG-DIAG-DOS",
        severity: "critical",
        title: "Diagnostic DoS Attack Detected",
        description: `진단 요청 ID(${DIAG_ID})가 ${DIAG_WINDOW_MS}ms 내에 ${this.diagCount}건 수신되었습니다. 진단 DoS 공격 패턴입니다.`,
        relatedMessages: related,
      };
    }
    return null;
  }

  private detectReplay(message: CanMessage, recentMessages: CanMessage[]): CanRuleMatch | null {
    const normalizedData = message.data.replace(/\s/g, "");
    const sameMessages = recentMessages.filter(
      (m) => m.id === message.id && m.data.replace(/\s/g, "") === normalizedData
    );

    if (sameMessages.length >= REPLAY_THRESHOLD) {
      // 같은 조합에 대해 연속 alert 방지: 직전 메시지도 같으면 이미 탐지된 것
      const prev = recentMessages[recentMessages.length - 1];
      if (prev && prev.id === message.id && prev.data.replace(/\s/g, "") === normalizedData) {
        if (sameMessages.length > REPLAY_THRESHOLD) return null;
      }

      return {
        ruleId: "CAN-SIG-REPLAY",
        severity: "high",
        title: `Replay Attack on ${message.id}`,
        description: `CAN ID ${message.id}에서 동일한 페이로드가 ${sameMessages.length + 1}회 반복되었습니다. 리플레이 공격 패턴입니다.`,
        relatedMessages: [...sameMessages, message],
      };
    }
    return null;
  }

  private detectBusOff(message: CanMessage, recentMessages: CanMessage[]): CanRuleMatch | null {
    const normalizedData = message.data.replace(/\s/g, "").toUpperCase();
    if (normalizedData !== BUS_OFF_PAYLOAD) return null;

    const sameBusOff = recentMessages.filter(
      (m) => m.data.replace(/\s/g, "").toUpperCase() === BUS_OFF_PAYLOAD
    );

    if (sameBusOff.length >= 2) {
      return {
        ruleId: "CAN-SIG-BUSOFF",
        severity: "critical",
        title: "Bus-Off Attack Pattern Detected",
        description: `모든 비트가 1인 페이로드(0xFF...)가 연속 수신되었습니다. Bus-Off 공격 패턴입니다.`,
        relatedMessages: [...sameBusOff.slice(-3), message],
      };
    }
    return null;
  }

  reset(): void {
    this.diagCount = 0;
    this.diagWindowStart = 0;
    this.diagAlerted = false;
  }
}
