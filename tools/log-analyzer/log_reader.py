"""AEGIS 교차 서비스 JSONL 로그 파서.

Observability v2 규약 기준:
- 필수 필드: level(숫자), time(epoch ms), service(문자열), msg, requestId
- 로그 위치: logs/*.jsonl (프로젝트 루트)
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any


def read_all_logs(logs_dir: str) -> list[dict[str, Any]]:
    """logs/*.jsonl 전체 읽기 → 시간순 정렬."""
    entries: list[dict[str, Any]] = []
    logs_path = Path(logs_dir)
    if not logs_path.exists():
        return entries

    for f in sorted(logs_path.glob("*.jsonl")):
        try:
            with open(f, "r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        entry["_file"] = f.name
                        entries.append(entry)
                    except json.JSONDecodeError:
                        pass
        except OSError:
            pass

    entries.sort(key=lambda e: e.get("time", 0))
    return entries


def filter_by_request_id(logs: list[dict], request_id: str) -> list[dict]:
    """requestId로 필터."""
    return [e for e in logs if e.get("requestId") == request_id]


def filter_by_level(logs: list[dict], min_level: int = 40) -> list[dict]:
    """레벨 필터 (숫자 기준). 기본: warn(40) 이상."""
    level_map = {"debug": 20, "info": 30, "warn": 40, "warning": 40, "error": 50, "fatal": 60}
    results = []
    for e in logs:
        lvl = e.get("level")
        if isinstance(lvl, (int, float)) and lvl >= min_level:
            results.append(e)
        elif isinstance(lvl, str) and level_map.get(lvl.lower(), 0) >= min_level:
            results.append(e)
    return results


def filter_by_service(logs: list[dict], service: str) -> list[dict]:
    """서비스 필터."""
    return [e for e in logs if e.get("service") == service]


def filter_by_time(logs: list[dict], since_ms: int) -> list[dict]:
    """시간 필터 (epoch ms 이후만)."""
    return [e for e in logs if e.get("time", 0) >= since_ms]


def group_by_request(logs: list[dict]) -> dict[str, list[dict]]:
    """requestId 기준 그룹핑."""
    groups: dict[str, list[dict]] = {}
    for e in logs:
        rid = e.get("requestId")
        if rid:
            groups.setdefault(rid, []).append(e)
    return groups


def format_elapsed(ms: float) -> str:
    """밀리초를 사람이 읽기 쉬운 형태로."""
    if ms < 1000:
        return f"{ms:.0f}ms"
    if ms < 60_000:
        return f"{ms / 1000:.1f}s"
    minutes = int(ms // 60_000)
    seconds = (ms % 60_000) / 1000
    return f"{minutes}m {seconds:.0f}s"


def _detect_origin(entries: list[dict]) -> str | None:
    """첫 S2 로그에서 HTTP 요청 경로 추출 (S1 제안: Origin 표시)."""
    for e in entries:
        if e.get("service") == "s2-backend":
            method = e.get("method") or e.get("req", {}).get("method")
            path = e.get("path") or e.get("req", {}).get("url")
            if method and path:
                return f"{method} {path}"
            # msg에서 추출 시도 (e.g. "→ POST :8001/v1/tasks")
            msg = e.get("msg", "")
            if msg.startswith("Request started") or "req" in str(e):
                return msg
    return None


def _format_agent_context(e: dict) -> str:
    """S3 agent 중첩 객체에서 turn/phase/timeout 정보 추출."""
    agent = e.get("agent", {})
    if not agent:
        return ""
    parts = []
    if agent.get("turn"):
        parts.append(f"turn={agent['turn']}")
    if agent.get("adaptiveTimeoutSec"):
        parts.append(f"timeout={agent['adaptiveTimeoutSec']:.0f}s")
    if agent.get("claimCount"):
        parts.append(f"claims={agent['claimCount']}")
    if agent.get("severity"):
        parts.append(f"severity={agent['severity']}")
    return f" ({', '.join(parts)})" if parts else ""


def build_waterfall(entries: list[dict]) -> str:
    """requestId로 필터된 로그 엔트리를 워터폴 텍스트로 변환."""
    if not entries:
        return "No log entries found."

    base_time = entries[0].get("time", 0)
    lines: list[str] = []

    # Origin 감지 (S1 제안)
    origin = _detect_origin(entries)

    for e in entries:
        offset = e.get("time", 0) - base_time
        service = e.get("service", "???")
        msg = e.get("msg", "")
        elapsed = e.get("elapsedMs") or e.get("latencyMs")
        target = e.get("target", "")
        status = e.get("status")
        level = e.get("level", 30)

        # 레벨 표시 (에러/경고만)
        prefix = ""
        if isinstance(level, (int, float)):
            if level >= 50:
                prefix = "[ERROR] "
            elif level >= 40:
                prefix = "[WARN] "

        # S3 agent 컨텍스트 (S3 제안)
        agent_ctx = _format_agent_context(e)

        offset_str = format_elapsed(offset)
        line = f"[+{offset_str:>8}]  {service:<14} {prefix}{msg}{agent_ctx}"

        if target:
            line += f"  → {target}"
        if status:
            line += f"  ({status})"
        if elapsed and isinstance(elapsed, (int, float)):
            line += f"  [{format_elapsed(elapsed)}]"

        lines.append(line)

    total_ms = entries[-1].get("time", 0) - base_time
    header = f"Total: {format_elapsed(total_ms)} | {len(entries)} log entries"
    if origin:
        header += f"\nOrigin: {origin}"

    return f"{header}\n{'─' * 80}\n" + "\n".join(lines)


def summarize_request(entries: list[dict]) -> dict[str, Any]:
    """요청 그룹의 요약 정보."""
    if not entries:
        return {}

    services = sorted(set(e.get("service", "?") for e in entries))
    first_time = entries[0].get("time", 0)
    last_time = entries[-1].get("time", 0)
    has_error = any(
        isinstance(e.get("level"), (int, float)) and e["level"] >= 50
        for e in entries
    )

    return {
        "requestId": entries[0].get("requestId", ""),
        "services": services,
        "entryCount": len(entries),
        "firstTime": first_time,
        "lastTime": last_time,
        "durationMs": last_time - first_time,
        "hasError": has_error,
    }


def compute_service_stats(logs: list[dict], service: str | None = None) -> list[dict[str, Any]]:
    """서비스별 통계."""
    by_service: dict[str, list[dict]] = {}
    for e in logs:
        svc = e.get("service")
        if svc:
            if service and svc != service:
                continue
            by_service.setdefault(svc, []).append(e)

    stats = []
    for svc, entries in sorted(by_service.items()):
        error_count = sum(1 for e in entries if isinstance(e.get("level"), (int, float)) and e["level"] >= 50)
        warn_count = sum(1 for e in entries if isinstance(e.get("level"), (int, float)) and e["level"] == 40)

        # elapsedMs/latencyMs 지연 통계
        latencies = [
            e.get("elapsedMs") or e.get("latencyMs")
            for e in entries
            if isinstance(e.get("elapsedMs"), (int, float)) or isinstance(e.get("latencyMs"), (int, float))
        ]
        latencies = [x for x in latencies if isinstance(x, (int, float))]
        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        max_latency = max(latencies) if latencies else 0

        # 토큰 사용량
        total_prompt = 0
        total_completion = 0
        for e in entries:
            usage = e.get("tokenUsage") or e.get("usage")
            if isinstance(usage, dict):
                total_prompt += usage.get("prompt", 0) or usage.get("prompt_tokens", 0)
                total_completion += usage.get("completion", 0) or usage.get("completion_tokens", 0)

        # 도구 호출 빈도 (S3 제안: toolCalls 집계)
        tool_counter: Counter[str] = Counter()
        for e in entries:
            tool_calls = e.get("toolCalls")
            if isinstance(tool_calls, list):
                tool_counter.update(tool_calls)

        result: dict[str, Any] = {
            "service": svc,
            "totalEntries": len(entries),
            "errors": error_count,
            "warnings": warn_count,
            "avgLatencyMs": round(avg_latency, 1),
            "maxLatencyMs": round(max_latency, 1),
            "totalPromptTokens": total_prompt,
            "totalCompletionTokens": total_completion,
        }
        if tool_counter:
            result["toolCalls"] = dict(tool_counter.most_common(10))

        stats.append(result)

    return stats
