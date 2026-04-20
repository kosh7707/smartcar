import type { Severity } from "@aegis/shared";

export const CWE_DESCRIPTIONS: Record<string, string> = {
  "CWE-120": "버퍼 오버플로우 (Buffer Copy without Checking Size)",
  "CWE-121": "스택 기반 버퍼 오버플로우",
  "CWE-122": "힙 기반 버퍼 오버플로우",
  "CWE-125": "범위 밖 읽기 (Out-of-bounds Read)",
  "CWE-190": "정수 오버플로우",
  "CWE-252": "반환값 미검사 (Unchecked Return Value)",
  "CWE-287": "부적절한 인증",
  "CWE-295": "부적절한 인증서 검증",
  "CWE-306": "중요 기능의 인증 누락",
  "CWE-416": "해제 후 사용 (Use After Free)",
  "CWE-476": "널 포인터 역참조",
  "CWE-561": "도달 불가 코드 (Dead Code)",
  "CWE-676": "위험 함수 사용",
  "CWE-787": "범위 밖 쓰기 (Out-of-bounds Write)",
  "CWE-798": "하드코딩된 자격증명",
  "CWE-119": "메모리 버퍼 경계 미검사",
  "CWE-200": "민감 정보 노출",
  "CWE-400": "자원 소모 (Resource Exhaustion)",
  "CWE-415": "이중 해제 (Double Free)",
  "CWE-469": "포인터 연산에서의 잘못된 크기값 사용",
};

export const SEVERITY_KO_LABELS: Record<Severity | "all", string> = {
  all: "전체",
  critical: "치명",
  high: "높음",
  medium: "보통",
  low: "낮음",
  info: "정보",
};

export const SEVERITY_SURFACE_CLASSES: Record<Severity, string> = {
  critical: "vuln-tone vuln-tone--critical",
  high: "vuln-tone vuln-tone--high",
  medium: "vuln-tone vuln-tone--medium",
  low: "vuln-tone vuln-tone--low",
  info: "vuln-tone vuln-tone--info",
};

export const SEVERITY_STRIP_CLASSES: Record<Severity, string> = {
  critical: "vuln-strip vuln-strip--critical",
  high: "vuln-strip vuln-strip--high",
  medium: "vuln-strip vuln-strip--medium",
  low: "vuln-strip vuln-strip--low",
  info: "vuln-strip vuln-strip--info",
};
