"""AEGIS Log Analyzer — MCP Server.

교차 서비스 JSONL 로그를 분석하는 MCP 도구 4개를 제공한다.
Observability v2 규약 (service, requestId, level 숫자, time epoch ms) 기반.

사용법:
  claude mcp add log-analyzer -- python tools/log-analyzer/server.py
  또는 .mcp.json 에 직접 등록
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

# server.py와 같은 디렉토리의 log_reader를 임포트할 수 있도록 보장
sys.path.insert(0, str(Path(__file__).resolve().parent))

from mcp.server.fastmcp import FastMCP

from log_reader import (
    read_all_logs,
    filter_by_request_id,
    filter_by_level,
    filter_by_service,
    filter_by_time,
    group_by_request,
    build_waterfall,
    summarize_request,
    compute_service_stats,
    format_elapsed,
)

# ── 설정 ──
LOGS_DIR = os.environ.get("LOGS_DIR", str(Path(__file__).resolve().parent.parent.parent / "logs"))

mcp = FastMCP("AEGIS Log Analyzer")


@mcp.tool()
def trace_request(request_id: str) -> str:
    """특정 requestId의 전 서비스 파이프라인을 시간순 워터폴로 추적한다.

    Args:
        request_id: 추적할 X-Request-Id 값 (e.g. "req-abc123")
    """
    logs = read_all_logs(LOGS_DIR)
    entries = filter_by_request_id(logs, request_id)

    if not entries:
        return f"requestId '{request_id}'에 대한 로그를 찾지 못했습니다.\n검색 대상: {LOGS_DIR}"

    waterfall = build_waterfall(entries)
    services = sorted(set(e.get("service", "?") for e in entries))

    return (
        f"Request: {request_id}\n"
        f"Services: {', '.join(services)}\n"
        f"{'═' * 80}\n"
        f"{waterfall}"
    )


@mcp.tool()
def search_errors(
    since_minutes: int = 60,
    service: str | None = None,
    request_id: str | None = None,
    min_level: int = 50,
    limit: int = 20,
) -> str:
    """최근 에러/경고 로그를 검색한다.

    Args:
        since_minutes: 최근 N분 이내 (기본 60분)
        service: 특정 서비스만 필터 (e.g. "s3-agent"). None이면 전체.
        request_id: 특정 요청의 에러만 필터 (e.g. "req-abc123"). None이면 전체.
        min_level: 최소 로그 레벨 (40=warn, 50=error, 60=fatal). 기본 50.
        limit: 최대 결과 수 (기본 20)
    """
    logs = read_all_logs(LOGS_DIR)

    since_ms = int((time.time() - since_minutes * 60) * 1000)
    logs = filter_by_time(logs, since_ms)

    if service:
        logs = filter_by_service(logs, service)

    if request_id:
        logs = filter_by_request_id(logs, request_id)

    errors = filter_by_level(logs, min_level)
    errors = errors[-limit:]  # 최근 N개

    if not errors:
        svc_info = f" (service={service})" if service else ""
        return f"최근 {since_minutes}분 내 level>={min_level} 로그 없음{svc_info}."

    lines = []
    level_names = {20: "DEBUG", 30: "INFO", 40: "WARN", 50: "ERROR", 60: "FATAL"}
    for e in errors:
        lvl = e.get("level", "?")
        lvl_name = level_names.get(lvl, str(lvl)) if isinstance(lvl, int) else str(lvl)
        ts = e.get("time", 0)
        svc = e.get("service", "?")
        msg = e.get("msg", "")
        rid = e.get("requestId", "")

        lines.append(f"[{lvl_name:>5}] {svc:<14} {msg}")
        if rid:
            lines[-1] += f"  (requestId: {rid})"

    return f"최근 {since_minutes}분, level>={min_level}: {len(errors)}건\n{'─' * 80}\n" + "\n".join(lines)


@mcp.tool()
def list_requests(limit: int = 10, service: str | None = None) -> str:
    """최근 requestId 목록을 요약과 함께 반환한다.

    Args:
        limit: 최대 결과 수 (기본 10)
        service: 특정 서비스가 포함된 요청만 필터
    """
    logs = read_all_logs(LOGS_DIR)

    if service:
        logs = filter_by_service(logs, service)

    groups = group_by_request(logs)

    # 최근 요청 순 정렬
    summaries = []
    for rid, entries in groups.items():
        s = summarize_request(entries)
        if s:
            summaries.append(s)

    summaries.sort(key=lambda s: s.get("lastTime", 0), reverse=True)
    summaries = summaries[:limit]

    if not summaries:
        return "requestId가 포함된 로그가 없습니다."

    lines = []
    for s in summaries:
        error_mark = " [ERROR]" if s["hasError"] else ""
        duration = format_elapsed(s["durationMs"])
        services = ", ".join(s["services"])
        lines.append(
            f"{s['requestId']:<40} {duration:>8}  {services}{error_mark}"
        )

    header = f"최근 {len(summaries)}건의 요청:\n{'─' * 80}"
    return f"{header}\n" + "\n".join(lines)


@mcp.tool()
def service_stats(service: str | None = None, since_minutes: int = 60) -> str:
    """서비스별 통계를 반환한다 (요청 수, 지연, 에러율, 토큰 사용량).

    Args:
        service: 특정 서비스만 (e.g. "s7-gateway"). None이면 전체.
        since_minutes: 최근 N분 이내 (기본 60분)
    """
    logs = read_all_logs(LOGS_DIR)

    since_ms = int((time.time() - since_minutes * 60) * 1000)
    logs = filter_by_time(logs, since_ms)

    stats = compute_service_stats(logs, service)

    if not stats:
        return "해당 조건에 맞는 로그가 없습니다."

    lines = []
    for s in stats:
        error_rate = f"{s['errors'] / s['totalEntries'] * 100:.1f}%" if s["totalEntries"] > 0 else "0%"
        line = (
            f"{s['service']:<14} "
            f"entries={s['totalEntries']:<6} "
            f"errors={s['errors']:<4} "
            f"warns={s['warnings']:<4} "
            f"err_rate={error_rate:<6} "
            f"avg_lat={format_elapsed(s['avgLatencyMs']):>8} "
            f"max_lat={format_elapsed(s['maxLatencyMs']):>8}"
        )
        if s["totalPromptTokens"] > 0:
            line += f"  tokens=({s['totalPromptTokens']}p/{s['totalCompletionTokens']}c)"
        if s.get("toolCalls"):
            tools_str = ", ".join(f"{k}×{v}" for k, v in s["toolCalls"].items())
            line += f"  tools=[{tools_str}]"
        lines.append(line)

    header = f"서비스 통계 (최근 {since_minutes}분):\n{'─' * 100}"
    return f"{header}\n" + "\n".join(lines)


if __name__ == "__main__":
    mcp.run()
