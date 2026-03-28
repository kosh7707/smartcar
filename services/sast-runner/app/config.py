from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 9000
    default_rulesets_csv: str = "p/c,p/security-audit"
    scan_timeout: int = 120
    max_concurrent_scans: int = 1
    custom_rules_dir: str | None = "rules"
    sdk_root: str | None = None
    log_dir: str = ""

    # 도구별 기본값 — 환경변수 오버라이드 가능 (SAST_ prefix)
    default_language_standard: str = "c++17"
    semgrep_per_rule_timeout: int = 5
    semgrep_max_target_bytes: int = 1_000_000

    # LibraryDiffer clone cache
    lib_cache_dir: str | None = None
    lib_cache_ttl: int = 3600

    @property
    def default_rulesets(self) -> list[str]:
        return [s.strip() for s in self.default_rulesets_csv.split(",") if s.strip()]

    model_config = {"env_prefix": "SAST_", "env_file": ".env"}


settings = Settings()
