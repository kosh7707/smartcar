"""Compatibility shim for the renamed code graph callers tool.

Prefer importing ``CodeGraphCallersTool`` from
``app.tools.implementations.codegraph_callers_tool``. This module remains so
older tests or local scripts that import ``codegraph_tool`` do not break during
the terminology cleanup window.
"""

from __future__ import annotations

from app.tools.implementations.codegraph_callers_tool import CodeGraphCallersTool

__all__ = ["CodeGraphCallersTool"]
