"""ToolRegistry 단위 테스트."""

from app.agent_runtime.schemas.agent import ToolCostTier
from app.agent_runtime.tools.registry import ToolRegistry, ToolSchema


def _make_schema(name: str = "test.tool", tier: ToolCostTier = ToolCostTier.CHEAP) -> ToolSchema:
    return ToolSchema(
        name=name,
        description=f"Test tool {name}",
        parameters={"type": "object", "properties": {"q": {"type": "string"}}},
        cost_tier=tier,
    )


def test_register_and_get():
    r = ToolRegistry()
    r.register(_make_schema("a"))
    assert r.get("a") is not None
    assert r.get("b") is None


def test_get_all_schemas_openai_format():
    r = ToolRegistry()
    r.register(_make_schema("a"))
    r.register(_make_schema("b"))
    schemas = r.get_all_schemas()
    assert len(schemas) == 2
    assert schemas[0]["type"] == "function"
    assert "function" in schemas[0]
    assert schemas[0]["function"]["name"] == "a"


def test_cost_tier_lookup():
    r = ToolRegistry()
    r.register(_make_schema("a", ToolCostTier.EXPENSIVE))
    assert r.get_cost_tier("a") == ToolCostTier.EXPENSIVE
    assert r.get_cost_tier("unknown") == ToolCostTier.CHEAP  # default


def test_list_names():
    r = ToolRegistry()
    r.register(_make_schema("x"))
    r.register(_make_schema("y"))
    assert set(r.list_names()) == {"x", "y"}


def test_unregister():
    r = ToolRegistry()
    r.register(_make_schema("x"))
    r.unregister("x")
    assert r.get("x") is None
