import type { ArtifactType, LocatorType } from "@aegis/shared";

export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  "analysis-result": "분석 결과",
  "uploaded-file": "업로드 파일",
  "dynamic-session": "동적 세션",
  "test-result": "테스트 결과",
};

export const LOCATOR_TYPE_LABELS: Record<LocatorType, string> = {
  "line-range": "소스 코드",
  "packet-range": "CAN 프레임",
  "timestamp-window": "시간 범위",
  "request-response-pair": "요청/응답",
};
