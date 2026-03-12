from __future__ import annotations

from app.errors import LlmHttpError, LlmTimeoutError, LlmUnavailableError
from app.services.clients.base import LlmClient


class RealLlmClient(LlmClient):

    def __init__(self, endpoint: str, model: str, api_key: str = ""):
        self.endpoint = endpoint
        self.model = model
        self.api_key = api_key

    async def generate(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> str:
        import httpx

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self.endpoint}/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": self.model,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except httpx.TimeoutException as e:
            raise LlmTimeoutError() from e
        except httpx.ConnectError as e:
            raise LlmUnavailableError() from e
        except httpx.HTTPStatusError as e:
            raise LlmHttpError(e.response.status_code) from e
        except (KeyError, IndexError) as e:
            raise LlmHttpError(
                502, "LLM 응답 구조가 예상과 다릅니다"
            ) from e
