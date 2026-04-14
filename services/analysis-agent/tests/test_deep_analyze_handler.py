from app.core.phase_one_types import Phase1Result
from app.routers.deep_analyze_handler import _configure_phase2_graph_tools
from agent_shared.tools.registry import ToolRegistry, ToolSchema


def _register_graph_tools(registry: ToolRegistry) -> None:
    for name in ("code_graph.callers", "code_graph.callees", "code_graph.search"):
        registry.register(ToolSchema(name=name, description=name))


class _Tool:
    def __init__(self):
        self.project_id = None

    def set_project_id(self, project_id: str) -> None:
        self.project_id = project_id


def test_configure_phase2_graph_tools_removes_unready_graph_search():
    registry = ToolRegistry()
    _register_graph_tools(registry)
    callers = _Tool()
    callees = _Tool()
    search = _Tool()

    phase1 = Phase1Result(
        code_graph_neo4j_ready=True,
        code_graph_graph_rag_ready=False,
    )

    _configure_phase2_graph_tools(
        registry,
        phase1,
        "proj-1",
        callers_tool=callers,
        callees_tool=callees,
        search_tool=search,
    )

    assert registry.get("code_graph.callers") is not None
    assert registry.get("code_graph.callees") is not None
    assert registry.get("code_graph.search") is None
    assert callers.project_id == "proj-1"
    assert callees.project_id == "proj-1"
    assert search.project_id is None


def test_configure_phase2_graph_tools_removes_all_graph_tools_when_neo4j_not_ready():
    registry = ToolRegistry()
    _register_graph_tools(registry)
    callers = _Tool()
    callees = _Tool()
    search = _Tool()

    phase1 = Phase1Result(
        code_graph_neo4j_ready=False,
        code_graph_graph_rag_ready=False,
    )

    _configure_phase2_graph_tools(
        registry,
        phase1,
        "proj-1",
        callers_tool=callers,
        callees_tool=callees,
        search_tool=search,
    )

    assert registry.get("code_graph.callers") is None
    assert registry.get("code_graph.callees") is None
    assert registry.get("code_graph.search") is None
