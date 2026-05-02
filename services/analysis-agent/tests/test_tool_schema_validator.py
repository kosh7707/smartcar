from __future__ import annotations

import pytest

from app.agent_runtime.tools.schema_validator import validate_tool_arguments


CURRENT_TOOL_CASES = [
    (
        "code_graph.callers",
        {
            "type": "object",
            "properties": {
                "function_name": {"type": "string"},
                "depth": {"type": "integer"},
            },
            "required": ["function_name"],
        },
        {"function_name": "popen", "depth": 2},
    ),
    (
        "code_graph.callees",
        {
            "type": "object",
            "properties": {
                "function_name": {"type": "string"},
            },
            "required": ["function_name"],
        },
        {"function_name": "handleRequest"},
    ),
    (
        "code_graph.search",
        {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "top_k": {"type": "integer"},
                "include_call_chain": {"type": "boolean"},
            },
            "required": ["query"],
        },
        {"query": "network handler", "top_k": 5, "include_call_chain": True},
    ),
    (
        "knowledge.search",
        {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "top_k": {"type": "integer"},
                "source_filter": {"type": "array", "items": {"type": "string"}},
                "exclude_ids": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["query"],
        },
        {
            "query": "command injection CWE-78",
            "top_k": 5,
            "source_filter": ["CWE", "CVE"],
            "exclude_ids": ["CWE-79"],
        },
    ),
    (
        "code.read_file",
        {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
            },
            "required": ["path"],
        },
        {"path": "src/main.c"},
    ),
    (
        "build.metadata",
        {"type": "object", "properties": {}},
        {},
    ),
]


@pytest.mark.parametrize(("tool_name", "schema", "arguments"), CURRENT_TOOL_CASES)
def test_current_analysis_tool_schemas_accept_valid_minimal_arguments(tool_name: str, schema: dict, arguments: dict) -> None:
    assert validate_tool_arguments(arguments, schema) == [], tool_name


def test_missing_required_field_reports_path() -> None:
    schema = {
        "type": "object",
        "properties": {"function_name": {"type": "string"}},
        "required": ["function_name"],
    }

    violations = validate_tool_arguments({}, schema)

    assert violations == ["MISSING $.function_name"]


def test_integer_validation_rejects_bool_values() -> None:
    schema = {
        "type": "object",
        "properties": {
            "function_name": {"type": "string"},
            "depth": {"type": "integer"},
        },
        "required": ["function_name"],
    }

    violations = validate_tool_arguments({"function_name": "popen", "depth": True}, schema)

    assert violations == ["TYPE $.depth: expected integer, got bool"]


def test_array_item_type_violations_include_index_path() -> None:
    schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "source_filter": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["query"],
    }

    violations = validate_tool_arguments({"query": "cwe", "source_filter": ["CWE", 7]}, schema)

    assert violations == ["TYPE $.source_filter[1]: expected string, got int"]


def test_unknown_properties_are_allowed_by_default() -> None:
    schema = {
        "type": "object",
        "properties": {"query": {"type": "string"}},
        "required": ["query"],
    }

    assert validate_tool_arguments({"query": "cwe", "extra": 7}, schema) == []


def test_additional_properties_false_blocks_extra_keys() -> None:
    schema = {
        "type": "object",
        "properties": {"query": {"type": "string"}},
        "required": ["query"],
        "additionalProperties": False,
    }

    violations = validate_tool_arguments({"query": "cwe", "extra": 7}, schema)

    assert violations == ["UNEXPECTED $.extra"]
