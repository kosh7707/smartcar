"""Compatibility wrapper for the shared ToolRouter core."""

from app.agent_runtime.tools.router_core import SharedToolRouter


def register_tools_for_session(
    registry,
    session,
    *,
    project_id: str,
    callers_tool=None,
    callees_tool=None,
    search_tool=None,
) -> None:
    """Filter the Phase 2 registry using readiness discovered before AgentLoop.

    Tool availability must be removed from the ToolRegistry before schemas are
    exposed to the LLM. ToolRouter.execute is intentionally not the authority:
    by execution time the model may already have seen unavailable tools.
    """
    neo4j_ready = getattr(session, "code_graph_neo4j_ready", None) is not False
    graph_rag_ready = getattr(session, "code_graph_graph_rag_ready", None) is not False

    if neo4j_ready:
        _set_project_id(callers_tool, project_id)
        _set_project_id(callees_tool, project_id)
    else:
        registry.unregister("code_graph.callers")
        registry.unregister("code_graph.callees")
        registry.unregister("code_graph.search")

    if neo4j_ready and graph_rag_ready:
        _set_project_id(search_tool, project_id)
    else:
        registry.unregister("code_graph.search")

    if getattr(session, "kb_not_ready", False):
        registry.unregister("knowledge.search")


def _set_project_id(tool, project_id: str) -> None:
    if tool is not None and hasattr(tool, "set_project_id"):
        tool.set_project_id(project_id)


class ToolRouter(SharedToolRouter):
    """Analysis-agent ToolRouter."""
