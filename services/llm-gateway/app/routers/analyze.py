import logging
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.context import get_request_id, set_request_id
from app.errors import LlmHttpError, LlmTimeoutError, LlmUnavailableError, S3Error
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


def _error_response(
    status_code: int,
    message: str,
    *,
    code: str,
    retryable: bool = False,
) -> JSONResponse:
    request_id = get_request_id()
    body = {
        "success": False,
        "vulnerabilities": [],
        "error": message,
        "errorDetail": {
            "code": code,
            "message": message,
            "requestId": request_id,
            "retryable": retryable,
        },
    }
    headers = {"X-Request-Id": request_id} if request_id else {}
    return JSONResponse(status_code=status_code, content=body, headers=headers)


def _ok_response(result) -> JSONResponse:
    request_id = get_request_id()
    body = AnalyzeResponse(
        success=True,
        vulnerabilities=result.vulnerabilities,
        note=result.note,
    ).model_dump(mode="json")
    headers = {"X-Request-Id": request_id} if request_id else {}
    return JSONResponse(content=body, headers=headers)


@router.post("/api/llm/analyze")
async def analyze(request: AnalyzeRequest, req: Request) -> JSONResponse:
    set_request_id(req.headers.get("x-request-id"))

    if request.module not in VALID_MODULES:
        return _error_response(
            400,
            f"Invalid module: {request.module}. Must be one of {VALID_MODULES}",
            code="INVALID_INPUT",
        )

    start = time.time()
    try:
        messages = prompt_builder.build(request)

        for msg in messages:
            if msg["role"] == "system":
                logger.debug("[%s] System Prompt:\n%s", request.module, msg["content"])
            elif msg["role"] == "user":
                logger.debug(
                    "[%s] User Prompt (%d chars):\n%s",
                    request.module, len(msg["content"]), msg["content"],
                )

        raw_response = await llm_client.generate(
            messages,
            max_tokens=request.maxTokens,
            temperature=request.temperature,
        )

        logger.debug(
            "[%s] LLM Response (%d chars):\n%s",
            request.module, len(raw_response), raw_response,
        )

        result = response_parser.parse(raw_response)

        elapsed = time.time() - start

        if result.error:
            logger.warning(
                "[%s] Parse failed (%.2fs): %s",
                request.module, elapsed, result.error,
            )
            return _error_response(
                502, result.error, code="LLM_PARSE_ERROR", retryable=True,
            )

        logger.info(
            "[%s] Analysis completed (%.2fs) — %d vulnerabilities",
            request.module, elapsed, len(result.vulnerabilities),
        )
        return _ok_response(result)

    except LlmTimeoutError as e:
        elapsed = time.time() - start
        logger.error("[%s] LLM timeout (%.2fs)", request.module, elapsed)
        return _error_response(504, str(e), code=e.code, retryable=e.retryable)

    except (LlmUnavailableError, LlmHttpError) as e:
        elapsed = time.time() - start
        logger.error("[%s] LLM error (%.2fs): %s", request.module, elapsed, e)
        return _error_response(502, str(e), code=e.code, retryable=e.retryable)

    except S3Error as e:
        elapsed = time.time() - start
        logger.error("[%s] S3 error (%.2fs): %s", request.module, elapsed, e)
        return _error_response(502, str(e), code=e.code, retryable=e.retryable)

    except Exception:
        elapsed = time.time() - start
        logger.error(
            "[%s] Internal error (%.2fs)", request.module, elapsed, exc_info=True,
        )
        return _error_response(500, "Internal server error", code="INTERNAL_ERROR")
