from __future__ import annotations

import json
import re


class V1ResponseParser:
    """LLM 원시 응답 텍스트를 Assessment dict로 파싱한다."""

    def parse(self, raw: str) -> dict | None:
        # Qwen3 thinking 모드 방어: <think>...</think> 태그 제거
        text = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

        # 코드블록 감싸기 제거 (```json ... ``` 또는 ``` ... ```)
        match = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
        if match:
            text = match.group(1).strip()

        data = self._load_dict(text)
        if data is not None:
            return data

        decoder = json.JSONDecoder()
        for match in re.finditer(r"\{", text):
            try:
                candidate, _ = decoder.raw_decode(text[match.start():])
            except json.JSONDecodeError:
                continue
            if isinstance(candidate, dict):
                return candidate

        return None

    def _load_dict(self, text: str) -> dict | None:
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return None
        return data if isinstance(data, dict) else None
