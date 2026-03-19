from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 9000
    default_rulesets_csv: str = "p/c,p/security-audit"
    scan_timeout: int = 120
    max_concurrent_scans: int = 1
    custom_rules_dir: str | None = "rules"
    log_dir: str = ""

    @property
    def default_rulesets(self) -> list[str]:
        return [s.strip() for s in self.default_rulesets_csv.split(",") if s.strip()]

    model_config = {"env_prefix": "SAST_", "env_file": ".env"}


settings = Settings()
