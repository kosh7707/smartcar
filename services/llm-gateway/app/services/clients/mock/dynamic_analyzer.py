"""동적 분석 Mock — CAN 트래픽 패턴 분석."""

from __future__ import annotations

import re
from collections import Counter

from app.data.dynamic_templates import (
    BUSOFF_SIGNATURE,
    DIAG_ID,
    DIAG_THRESHOLD,
    KNOWN_CAN_RANGES,
    REPLAY_THRESHOLD,
)
from app.models.analysis import AnalysisResult
from app.models.vulnerability import VulnerabilityData


def analyze_dynamic(content: str) -> AnalysisResult:
    """canLog 내용을 분석하여 맥락에 맞는 동적 분석 결과를 반환한다."""
    can_section = _extract_can_section(content)
    parsed = _parse_can_lines(can_section)

    vulns: list[VulnerabilityData] = []

    # 1. 진단 서비스 DoS: 0x7DF 빈도 체크
    diag_count = sum(1 for cid, _ in parsed if cid == DIAG_ID)
    if diag_count >= DIAG_THRESHOLD:
        vulns.append(VulnerabilityData(
            severity="critical",
            title="Diagnostic Service DoS 공격 패턴 탐지",
            description=(
                f"OBD-II 진단 요청 ID(0x7DF)가 비정상적으로 높은 빈도({diag_count}회)로 "
                "감지되었습니다. 이는 UDS(ISO 14229) 진단 서비스를 대상으로 한 "
                "서비스 거부(DoS) 공격 패턴과 일치합니다. "
                "대량의 진단 요청은 ECU의 처리 큐를 포화시켜 "
                "정상 진단 및 제어 명령 처리를 방해할 수 있습니다. "
                "특히 안전 관련 ECU(브레이크, 조향)가 영향을 받으면 "
                "차량 안전에 직접적인 위협이 됩니다."
            ),
            location="CAN ID: 0x7DF",
            suggestion=(
                "진단 서비스 요청에 Rate Limiting을 적용하고, "
                "비정상 빈도의 요청을 게이트웨이 수준에서 차단하세요. "
                "IDS 룰에 진단 ID 빈도 임계값을 설정하세요."
            ),
            fix_code=None,
        ))

    # 2. 비인가 CAN ID: 알려진 범위 밖의 ID
    def _is_known(cid: int) -> bool:
        return any(lo <= cid <= hi for lo, hi in KNOWN_CAN_RANGES)

    unusual_ids = sorted({f"0x{cid:03X}" for cid, _ in parsed if not _is_known(cid)})
    if unusual_ids:
        vulns.append(VulnerabilityData(
            severity="medium",
            title="비인가 CAN ID 감지",
            description=(
                f"사전 정의된 CAN ID 범위에 없는 메시지가 감지되었습니다: "
                f"{', '.join(unusual_ids)}. "
                "ECU 스푸핑 또는 비인가 장치가 CAN 버스에 접속했을 가능성이 있습니다. "
                "비인가 노드가 안전 관련 메시지를 전송하면 "
                "차량 제어 시스템이 오동작할 수 있습니다."
            ),
            location=f"CAN ID: {', '.join(unusual_ids)}",
            suggestion=(
                "허용된 CAN ID 화이트리스트를 구성하고, "
                "미등록 ID 메시지를 게이트웨이에서 필터링하세요. "
                "IDS/IPS 룰을 업데이트하고 물리적 접근 통제를 강화하세요."
            ),
            fix_code=None,
        ))

    # 3. 리플레이 공격: 동일 ID+데이터 조합 반복
    sig_counter = Counter(f"0x{cid:03X} [{data}]" for cid, data in parsed)
    replayed = [sig for sig, cnt in sig_counter.items() if cnt >= REPLAY_THRESHOLD]
    if replayed:
        vulns.append(VulnerabilityData(
            severity="high",
            title="리플레이 공격 의심",
            description=(
                "동일한 CAN ID + 페이로드 조합이 3회 이상 반복 감지되었습니다: "
                f"{'; '.join(replayed)}. "
                "캡처된 정상 메시지를 재전송하는 리플레이 공격 가능성이 있습니다. "
                "CAN 프로토콜은 메시지 인증 메커니즘이 없어 "
                "수신 노드가 원본과 재전송을 구분할 수 없습니다."
            ),
            location="CAN Bus",
            suggestion=(
                "메시지 인증 코드(MAC)를 도입하거나, "
                "Freshness Value(카운터/타임스탬프)를 포함하여 리플레이를 방지하세요. "
                "AUTOSAR SecOC 모듈 적용을 검토하세요."
            ),
            fix_code=None,
        ))

    # 4. Bus-Off 공격: FF FF FF FF 페이로드
    busoff_ids = sorted({
        f"0x{cid:03X}" for cid, data in parsed if BUSOFF_SIGNATURE in data
    })
    if busoff_ids:
        vulns.append(VulnerabilityData(
            severity="high",
            title="Bus-Off 공격 시도 탐지",
            description=(
                f"전체 비트가 1인 페이로드(0xFF...)가 {', '.join(busoff_ids)}에서 "
                "감지되었습니다. CAN 컨트롤러의 에러 카운터를 의도적으로 증가시켜 "
                "Bus-Off 상태를 유발하는 공격 시도일 수 있습니다. "
                "Bus-Off 상태에 진입하면 해당 노드는 CAN 통신이 불가능해져 "
                "차량 기능이 마비될 수 있습니다."
            ),
            location=f"CAN ID: {', '.join(busoff_ids)}",
            suggestion=(
                "CAN 컨트롤러의 에러 카운터 모니터링을 강화하고, "
                "비정상 에러 프레임 발생 시 알림을 설정하세요. "
                "CAN FD의 향상된 에러 처리 기능 도입을 검토하세요."
            ),
            fix_code=None,
        ))

    if not vulns:
        return AnalysisResult(
            note="룰 엔진 탐지 항목 외에 추가 이상 패턴이 발견되지 않았습니다. "
                 "정상 트래픽 베이스라인을 수립하고, 편차 기반 이상 탐지를 적용하세요.",
        )

    return AnalysisResult(vulnerabilities=vulns)


def _extract_can_section(content: str) -> str:
    """프롬프트에서 [분석 대상 - CAN 트래픽 로그] ~ [출력 형식] 구간을 추출한다."""
    marker = "[분석 대상 - CAN 트래픽 로그]"
    idx = content.find(marker)
    if idx == -1:
        return content
    after = content[idx + len(marker):]
    end = after.find("[출력 형식]")
    if end != -1:
        after = after[:end]
    return after


def _parse_can_lines(can_text: str) -> list[tuple[int, str]]:
    """CAN 로그를 파싱하여 [(can_id_int, data_hex_str), ...] 리스트를 반환한다."""
    results: list[tuple[int, str]] = []
    for line in can_text.strip().split("\n"):
        m = re.match(r"\S+\s+(0x[0-9A-Fa-f]+)\s+\[\d+\]\s+(.+)", line.strip())
        if m:
            can_id = int(m.group(1), 16)
            data = m.group(2).strip().upper()
            results.append((can_id, data))
    return results
