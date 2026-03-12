from __future__ import annotations

import json
import re


class V1ResponseParser:
    """LLM 원시 응답 텍스트를 Assessment dict로 파싱한다."""

    def parse(self, raw: str) -> dict | None:
        text = raw.strip()

        # 코드블록 감싸기 제거 (```json ... ``` 또는 ``` ... ```)
        match = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
        if match:
            text = match.group(1).strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return None

        if not isinstance(data, dict):
            return None

        return data
