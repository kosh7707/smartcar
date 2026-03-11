from fastapi import APIRouter

from app.config import settings
from app.schemas.response import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    llm_status = "mock"

    if settings.llm_mode == "real":
        llm_status = "disconnected"
        try:
            import httpx

            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{settings.llm_endpoint}/health")
                if resp.status_code == 200:
                    llm_status = "connected"
        except Exception:
            pass

    return HealthResponse(
        service="smartcar-llm-gateway",
        status="ok",
        version="0.1.0",
        llmStatus=llm_status,
    )
