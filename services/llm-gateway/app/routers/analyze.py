import logging
import time

from fastapi import APIRouter, HTTPException

from app.schemas.request import AnalyzeRequest
from app.schemas.response import AnalyzeResponse
from app.services.clients import create_llm_client
from app.services.prompt_builder import PromptBuilder
from app.services.response_parser import ResponseParser

logger = logging.getLogger(__name__)
router = APIRouter()

prompt_builder = PromptBuilder()
response_parser = ResponseParser()
llm_client = create_llm_client()

VALID_MODULES = ("static_analysis", "dynamic_analysis", "dynamic_testing")


@router.post("/api/llm/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    if request.module not in VALID_MODULES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid module: {request.module}. Must be one of {VALID_MODULES}",
        )

    start = time.time()
    try:
        messages = prompt_builder.build(request)

        for msg in messages:
            if msg["role"] == "system":
                logger.info(
                    "[%s] === System Prompt ===\n%s", request.module, msg["content"],
                )
            elif msg["role"] == "user":
                logger.info(
                    "[%s] === User Prompt (%d chars) ===\n%s",
                    request.module, len(msg["content"]), msg["content"],
                )

        raw_response = await llm_client.generate(
            messages,
            max_tokens=request.maxTokens,
            temperature=request.temperature,
        )

        logger.info(
            "[%s] === LLM Response (%d chars) ===\n%s",
            request.module, len(raw_response), raw_response,
        )

        result = response_parser.parse(raw_response)

        elapsed = time.time() - start

        if result.error:
            logger.warning(
                "[%s] parse failed in %.2fs: %s",
                request.module, elapsed, result.error,
            )
            return AnalyzeResponse(
                success=False,
                vulnerabilities=[],
                error=result.error,
            )

        logger.info(
            "[%s] analysis done in %.2fs — %d vulnerabilities",
            request.module, elapsed, len(result.vulnerabilities),
        )

        return AnalyzeResponse(
            success=True,
            vulnerabilities=result.vulnerabilities,
            note=result.note,
        )

    except Exception as e:
        elapsed = time.time() - start
        logger.error("[%s] analysis failed in %.2fs: %s", request.module, elapsed, e)
        return AnalyzeResponse(success=False, vulnerabilities=[], error=str(e))
