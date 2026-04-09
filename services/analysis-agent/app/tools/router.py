"""Compatibility wrapper for the shared ToolRouter core."""

from agent_shared.tools.router_core import SharedToolRouter


class ToolRouter(SharedToolRouter):
    """Analysis-agent ToolRouter."""
