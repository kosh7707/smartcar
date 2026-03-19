"""
통합 위협 레코드 스키마 -- CWE/CVE/ATT&CK/CAPEC 정규화 대상
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


class UnifiedThreatRecord(BaseModel):
    """4-Layer 통합 위협 레코드: AttackSurface -> ThreatVector -> Vulnerability -> Mitigation"""

    # 식별
    id: str                                          # "CWE-787", "CVE-2023-29389", "T0866"
    source: str                                      # "CWE" | "CVE" | "ATT&CK" | "CAPEC"

    # Layer 1: AttackSurface (키워드 매칭 기반)
    attack_surfaces: list[str] = Field(default_factory=list)

    # Layer 2: ThreatVector
    threat_category: str = ""                        # "Memory Corruption", "Injection", ...
    attack_vector: Optional[str] = None              # CVSS attackVector 또는 ATT&CK tactic
    kill_chain_phase: Optional[str] = None           # ATT&CK kill chain phase

    # Layer 3: Vulnerability
    title: str = ""
    description: str = ""                            # 임베딩 대상
    severity: Optional[float] = None                 # CVSS baseScore (0.0-10.0)

    # Layer 4: Mitigation
    mitigations: list[str] = Field(default_factory=list)

    # 크로스 레퍼런스
    related_cwe: list[str] = Field(default_factory=list)
    related_cve: list[str] = Field(default_factory=list)
    related_attack: list[str] = Field(default_factory=list)
    related_capec: list[str] = Field(default_factory=list)

    # 메타데이터
    automotive_relevance: float = 0.0                # 0.0-1.0 (embedded+system+automotive 도메인 관련성)
    last_updated: str = ""                           # ISO 8601


class CapecBridge(BaseModel):
    """CAPEC -> CWE / ATT&CK 양방향 룩업 테이블"""
    capec_to_cwe: dict[str, list[str]] = Field(default_factory=dict)
    capec_to_attack: dict[str, list[str]] = Field(default_factory=dict)
    attack_to_capec: dict[str, list[str]] = Field(default_factory=dict)
    cwe_to_capec: dict[str, list[str]] = Field(default_factory=dict)
