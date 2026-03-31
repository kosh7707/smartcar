"""AEGIS 교차 서비스 JSONL 로그 파서.

Observability v2 규약 기준:
- 필수 필드: level(숫자), time(epoch ms), service(문자열), msg, requestId
- 로그 위치: logs/*.jsonl (프로젝트 루트)
- SQLite 캐시: mtime/size 기반 무효화, 인덱스 검색
"""

from __future__ import annotations

import json
import os
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any

# ── SQLite 캐시 ──

_cache_db_path: str | None = None
_cache_conn: sqlite3.Connection | None = None


def _get_cache_db(logs_dir: str) -> sqlite3.Connection:
    """캐시 DB 연결 반환 (없으면 생성)."""
    global _cache_db_path, _cache_conn

    db_path = str(Path(logs_dir) / ".log-cache.db")
    if _cache_conn is not None and _cache_db_path == db_path:
        return _cache_conn

    _cache_db_path = db_path
    _cache_conn = sqlite3.connect(db_path)
    _cache_conn.execute("PRAGMA journal_mode=WAL")
    _cache_conn.executescript("""
        CREATE TABLE IF NOT EXISTS log_entries (
            id INTEGER PRIMARY KEY,
            file TEXT NOT NULL,
            time REAL NOT NULL DEFAULT 0,
            level INTEGER NOT NULL DEFAULT 30,
            service TEXT NOT NULL DEFAULT '',
            request_id TEXT NOT NULL DEFAULT '',
            msg TEXT NOT NULL DEFAULT '',
            raw TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS file_meta (
            path TEXT PRIMARY KEY,
            mtime REAL NOT NULL,
            size INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_log_request_id ON log_entries(request_id);
        CREATE INDEX IF NOT EXISTS idx_log_service_time ON log_entries(service, time);
        CREATE INDEX IF NOT EXISTS idx_log_level_time ON log_entries(level, time);
        CREATE INDEX IF NOT EXISTS idx_log_time ON log_entries(time);
    """)
    return _cache_conn


def _ensure_cache(logs_dir: str) -> sqlite3.Connection:
    """JSONL 파일의 mtime/size를 체크하여 변경분만 캐시에 적재."""
    conn = _get_cache_db(logs_dir)
    logs_path = Path(logs_dir)
    if not logs_path.exists():
        return conn

    existing_meta: dict[str, tuple[float, int]] = {}
    for row in conn.execute("SELECT path, mtime, size FROM file_meta"):
        existing_meta[row[0]] = (row[1], row[2])

    current_files = set()
    for f in sorted(logs_path.glob("*.jsonl")):
        fname = str(f)
        current_files.add(fname)
        stat = f.stat()
        cur_mtime, cur_size = stat.st_mtime, stat.st_size

        prev = existing_meta.get(fname)
        if prev and prev[0] == cur_mtime and prev[1] == cur_size:
            continue

        # 파일이 변경됨 → 해당 파일의 캐시 제거 후 재적재
        conn.execute("DELETE FROM log_entries WHERE file = ?", (fname,))
        rows = []
        try:
            with open(f, "r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        rows.append((
                            fname,
                            entry.get("time", 0) or 0,
                            entry.get("level", 30) if isinstance(entry.get("level"), (int, float)) else 30,
                            entry.get("service") or "",
                            entry.get("requestId") or "",
                            entry.get("msg") or "",
                            line,
                        ))
                    except json.JSONDecodeError:
                        pass
        except OSError:
            pass

        if rows:
            conn.executemany(
                "INSERT INTO log_entries (file, time, level, service, request_id, msg, raw) VALUES (?,?,?,?,?,?,?)",
                rows,
            )
        conn.execute(
            "INSERT OR REPLACE INTO file_meta (path, mtime, size) VALUES (?, ?, ?)",
            (fname, cur_mtime, cur_size),
        )

    # 삭제된 파일 정리
    for fname in list(existing_meta.keys()):
        if fname not in current_files:
            conn.execute("DELETE FROM log_entries WHERE file = ?", (fname,))
            conn.execute("DELETE FROM file_meta WHERE path = ?", (fname,))

    conn.commit()
    return conn


def _rows_to_entries(conn: sqlite3.Connection, query: str, params: tuple = ()) -> list[dict[str, Any]]:
    """SQL 쿼리 결과를 dict 리스트로 변환."""
    entries: list[dict[str, Any]] = []
    for (raw,) in conn.execute(query, params):
        try:
            entry = json.loads(raw)
            entries.append(entry)
        except json.JSONDecodeError:
            pass
    return entries


def read_all_logs(logs_dir: str) -> list[dict[str, Any]]:
    """logs/*.jsonl 전체 읽기 → 시간순 정렬. SQLite 캐시 사용."""
    conn = _ensure_cache(logs_dir)
    return _rows_to_entries(conn, "SELECT raw FROM log_entries ORDER BY time ASC")


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


def search_by_message(logs: list[dict], query: str) -> list[dict]:
    """메시지(msg) 내용을 텍스트 검색 (case-insensitive)."""
    q = query.lower()
    return [e for e in logs if q in (e.get("msg") or "").lower()]


def truncate_msg(msg: str, max_len: int = 120) -> str:
    """긴 메시지를 잘라서 반환. JSON 객체 내부를 축약한다."""
    if len(msg) <= max_len:
        return msg
    # GqlStatusObject 등 중첩 JSON 패턴 축약
    import re
    msg = re.sub(r'\{[^{}]{200,}\}', '{...}', msg)
    msg = re.sub(r'\[[^\[\]]{200,}\]', '[...]', msg)
    if len(msg) <= max_len:
        return msg
    return msg[:max_len - 3] + "..."


def dedup_messages(entries: list[dict], msg_key: str = "msg") -> list[tuple[dict, int]]:
    """연속/동일 패턴 메시지를 그룹핑하여 (대표 entry, count) 리스트 반환."""
    import re

    def _normalize(msg: str) -> str:
        """requestId, 타임스탬프, UUID, 세션 ID 등을 제거하여 패턴 키 생성."""
        s = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<ID>', msg)
        s = re.sub(r'\d{13,}', '<TS>', s)  # epoch ms
        s = re.sub(r'requestId[=: ]+\S+', 'requestId=<RID>', s)
        # 일반적인 식별자 패턴 (e2e-xxx, session-xxx, req-xxx 등)
        s = re.sub(r'(?<=[=:\s/])[a-zA-Z0-9_-]{6,40}(?=[\s,;)\]}]|$)', '<VAR>', s)
        # 중첩 JSON 객체 축약
        s = re.sub(r'\{[^{}]{80,}\}', '{...}', s)
        return s

    if not entries:
        return []

    groups: list[tuple[dict, int]] = []
    prev_key = ""
    for e in entries:
        key = _normalize(e.get(msg_key, "")) + "|" + e.get("service", "")
        if key == prev_key and groups:
            groups[-1] = (groups[-1][0], groups[-1][1] + 1)
        else:
            groups.append((e, 1))
            prev_key = key

    return groups


def compute_llm_stats(logs: list[dict]) -> dict[str, Any] | None:
    """llm-exchange.jsonl 전용 통계 — 호출 수, 레이턴시, 토큰, tool_calls 비율."""
    llm_entries = [e for e in logs if e.get("type") in ("chat_proxy", "llm_call")]
    if not llm_entries:
        return None

    latencies = []
    prompt_tokens = []
    completion_tokens = []
    tool_call_count = 0
    content_count = 0

    for e in llm_entries:
        lat = e.get("elapsedMs") or e.get("latencyMs")
        if isinstance(lat, (int, float)):
            latencies.append(lat)

        usage = e.get("usage") or e.get("tokenUsage") or {}
        pt = usage.get("prompt", 0) or usage.get("prompt_tokens", 0)
        ct = usage.get("completion", 0) or usage.get("completion_tokens", 0)
        if pt:
            prompt_tokens.append(pt)
        if ct:
            completion_tokens.append(ct)

        fr = e.get("finishReason") or ""
        if "tool" in fr:
            tool_call_count += 1
        elif fr:
            content_count += 1

    total = tool_call_count + content_count
    return {
        "totalCalls": len(llm_entries),
        "avgLatencyMs": round(sum(latencies) / len(latencies), 1) if latencies else 0,
        "maxLatencyMs": round(max(latencies), 1) if latencies else 0,
        "maxLatencyEntry": max(llm_entries, key=lambda e: (e.get("elapsedMs") or e.get("latencyMs") or 0)) if llm_entries else None,
        "avgPromptTokens": round(sum(prompt_tokens) / len(prompt_tokens)) if prompt_tokens else 0,
        "maxPromptTokens": max(prompt_tokens) if prompt_tokens else 0,
        "totalPromptTokens": sum(prompt_tokens),
        "totalCompletionTokens": sum(completion_tokens),
        "toolCallRate": round(tool_call_count / total * 100, 1) if total > 0 else 0,
        "contentRate": round(content_count / total * 100, 1) if total > 0 else 0,
    }


def extract_turn_token_growth(logs: list[dict], request_id: str) -> list[dict[str, Any]]:
    """특정 requestId의 LLM exchange 턴별 프롬프트 토큰 증가 추적."""
    turns = [
        e for e in logs
        if e.get("requestId") == request_id and e.get("type") in ("chat_proxy", "llm_call")
    ]
    turns.sort(key=lambda e: e.get("time", 0))

    result = []
    prev_prompt = 0
    for i, e in enumerate(turns):
        usage = e.get("usage") or e.get("tokenUsage") or {}
        pt = usage.get("prompt", 0) or usage.get("prompt_tokens", 0)
        ct = usage.get("completion", 0) or usage.get("completion_tokens", 0)
        lat = e.get("elapsedMs") or e.get("latencyMs") or 0
        fr = e.get("finishReason") or "?"

        result.append({
            "turn": i + 1,
            "promptTokens": pt,
            "delta": pt - prev_prompt,
            "completionTokens": ct,
            "latencyMs": lat,
            "finishReason": fr,
        })
        prev_prompt = pt

    return result


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
