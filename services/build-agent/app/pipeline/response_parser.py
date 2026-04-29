from __future__ import annotations

import json
import re


class V1ResponseParser:
    """LLM 원시 응답 텍스트를 Assessment dict로 파싱한다."""

    def parse(self, raw: str) -> dict | None:
        # Qwen3 thinking 모드 방어: <think>...</think> 태그 제거
        text = _strip_thinking(raw)

        # 1차 시도: 원본 텍스트로 JSON 파싱
        data = self._try_parse(text)
        if data is not None:
            return data

        # 2차 시도: 전체가 코드 펜스로 감싸진 경우만 strip
        # (detail 내부의 ```python 등을 오인하지 않도록 전체 매칭만 허용)
        match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
        if match:
            data = self._try_parse(match.group(1).strip())
            if data is not None:
                return data

        return self._try_extract_json_object(text)

    @staticmethod
    def _try_parse(text: str) -> dict | None:
        try:
            # strict=False: LLM이 JSON string 안에 넣는 raw newline/tab 허용
            data = json.loads(text, strict=False)
        except json.JSONDecodeError:
            return None
        return data if isinstance(data, dict) else None

    @staticmethod
    def _try_extract_json_object(text: str) -> dict | None:
        start = text.find("{")
        if start < 0:
            return None
        try:
            data, _ = json.JSONDecoder(strict=False).raw_decode(text[start:])
        except json.JSONDecodeError:
            return None
        return data if isinstance(data, dict) else None


def _strip_thinking(raw: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL)
    while "<think>" in text:
        start = text.find("<think>")
        json_start = text.find("{", start)
        if json_start < 0:
            text = text[:start]
            break
        text = text[:start] + text[json_start:]
    return text.strip()
