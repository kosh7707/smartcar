"""Shared parser for JSON-object LLM responses."""

from __future__ import annotations

import json
import re


class V1ResponseParser:
    """Parse a raw LLM response into an Assessment-like dict."""

    def parse(self, raw: str) -> dict | None:
        text = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

        data = self._try_parse(text)
        if data is not None:
            return data

        match = re.match(r"^```(?:json)?\s*\n(.*)\n```\s*$", text, re.DOTALL)
        if not match:
            return None
        return self._try_parse(match.group(1).strip())

    @staticmethod
    def _try_parse(text: str) -> dict | None:
        try:
            data = json.loads(text, strict=False)
        except json.JSONDecodeError:
            return None
        return data if isinstance(data, dict) else None
