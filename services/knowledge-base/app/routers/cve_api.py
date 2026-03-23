"""CVE API — 실시간 NVD CVE 조회 엔드포인트."""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.context import set_request_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/cve", tags=["cve"])

_nvd_client = None


def set_nvd_client(client) -> None:
    global _nvd_client
    _nvd_client = client


class LibraryItem(BaseModel):
    model_config = {"populate_by_name": True}

    name: str = Field(..., description="라이브러리 이름 (예: libcurl)")
    version: str = Field(..., description="버전 문자열 (예: 7.68.0)")
    repo_url: str | None = Field(None, alias="repoUrl", description="upstream git URL (vendor 추론용)")
    commit: str | None = Field(None, description="git commit hash (OSV.dev 정밀 조회용)")


class BatchLookupRequest(BaseModel):
    libraries: list[LibraryItem] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="조회할 라이브러리 목록 (최대 20개)",
    )


@router.post("/batch-lookup")
async def batch_lookup(
    req: BatchLookupRequest,
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
) -> dict:
    set_request_id(x_request_id)
    start = time.monotonic()

    if _nvd_client is None:
        raise HTTPException(503, "NVD client not initialized")

    results = await _nvd_client.batch_lookup(
        [{"name": lib.name, "version": lib.version, "repo_url": lib.repo_url, "commit": lib.commit} for lib in req.libraries]
    )

    elapsed_ms = int((time.monotonic() - start) * 1000)
    total_cves = sum(r.get("total", 0) for r in results)

    logger.info(
        "CVE 배치 조회",
        extra={"_extra": {
            "libraryCount": len(req.libraries),
            "totalCves": total_cves,
            "latencyMs": elapsed_ms,
        }},
    )

    return {
        "results": results,
        "latency_ms": elapsed_ms,
    }
