"""Compatibility wrapper for the shared ToolRouter core."""

from app.agent_runtime.tools.router_core import SharedToolRouter


class ToolRouter(SharedToolRouter):
    """Analysis-agent ToolRouter."""
