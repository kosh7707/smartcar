"""Prometheus 메트릭 정의.

모든 메트릭은 aegis_llm_ 접두사를 사용한다.
"""
from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram

REQUEST_COUNT = Counter(
    "aegis_llm_requests_total",
    "Total LLM requests",
    ["endpoint", "status"],
)

REQUEST_DURATION = Histogram(
    "aegis_llm_request_duration_seconds",
    "LLM request duration",
    ["endpoint"],
    buckets=(0.5, 1, 2, 5, 10, 20, 30, 60, 120),
)

TOKEN_COUNT = Counter(
    "aegis_llm_tokens_total",
    "Total tokens consumed",
    ["type"],
)

ERROR_COUNT = Counter(
    "aegis_llm_errors_total",
    "Total LLM errors",
    ["endpoint", "error_type"],
)

CIRCUIT_BREAKER_STATE = Gauge(
    "aegis_llm_circuit_breaker_state",
    "Circuit breaker state (0=closed, 0.5=half_open, 1=open)",
)

CONCURRENT_REQUESTS = Gauge(
    "aegis_llm_concurrent_requests",
    "Current in-flight LLM requests",
)
