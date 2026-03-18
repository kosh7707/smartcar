from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 9000
    default_rulesets: list[str] = ["p/c", "p/security-audit"]
    scan_timeout: int = 120
    max_concurrent_scans: int = 1
    custom_rules_dir: str | None = None
    log_dir: str = ""

    @field_validator("default_rulesets", mode="before")
    @classmethod
    def parse_rulesets(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    model_config = {"env_prefix": "SAST_", "env_file": ".env"}


settings = Settings()
