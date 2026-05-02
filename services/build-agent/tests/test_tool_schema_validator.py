from __future__ import annotations

import pytest

from app.agent_runtime.tools.schema_validator import validate_tool_arguments


CURRENT_TOOL_CASES = [
    (
        "build_resolve.list_files",
        {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "max_depth": {"type": "integer"},
            },
        },
        {"path": "build", "max_depth": 3},
    ),
    (
        "build_resolve.read_file",
        {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
        {"path": "build/aegis-build.sh"},
    ),
    (
        "build_resolve.write_file",
        {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["path", "content"],
        },
        {"path": "aegis-build.sh", "content": "echo hi"},
    ),
    (
        "build_resolve.edit_file",
        {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["path", "content"],
        },
        {"path": "aegis-build.sh", "content": "echo updated"},
    ),
    (
        "build_resolve.delete_file",
        {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
        {"path": "aegis-build.sh"},
    ),
    (
        "build_resolve.try_build",
        {
            "type": "object",
            "properties": {
                "build_command": {"type": "string"},
                "build_environment": {
                    "type": "object",
                    "additionalProperties": {"type": "string"},
                },
            },
            "required": ["build_command"],
        },
        {"build_command": "bash build/aegis-build.sh", "build_environment": {"CC": "clang"}},
    ),
    (
        "sdk_analyze.list_files",
        {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "max_depth": {"type": "integer"},
            },
        },
        {"path": "include", "max_depth": 2},
    ),
    (
        "sdk_analyze.read_file",
        {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
        {"path": "README.md"},
    ),
    (
        "sdk_analyze.try_build",
        {
            "type": "object",
            "properties": {"build_command": {"type": "string"}},
            "required": ["build_command"],
        },
        {"build_command": "arm-gcc --version"},
    ),
]


@pytest.mark.parametrize(("tool_name", "schema", "arguments"), CURRENT_TOOL_CASES)
def test_current_build_tool_schemas_accept_valid_minimal_arguments(tool_name: str, schema: dict, arguments: dict) -> None:
    assert validate_tool_arguments(arguments, schema) == [], tool_name


def test_missing_required_field_reports_path() -> None:
    schema = {
        "type": "object",
        "properties": {"path": {"type": "string"}},
        "required": ["path"],
    }

    violations = validate_tool_arguments({}, schema)

    assert violations == ["MISSING $.path"]


def test_object_map_values_follow_additional_properties_type() -> None:
    schema = {
        "type": "object",
        "properties": {
            "build_command": {"type": "string"},
            "build_environment": {
                "type": "object",
                "additionalProperties": {"type": "string"},
            },
        },
        "required": ["build_command"],
    }

    violations = validate_tool_arguments(
        {"build_command": "make", "build_environment": {"CC": 1}},
        schema,
    )

    assert violations == ["TYPE $.build_environment.CC: expected string, got int"]


def test_array_and_object_defaults_still_allow_extra_keys_when_not_forbidden() -> None:
    schema = {
        "type": "object",
        "properties": {"path": {"type": "string"}},
    }

    assert validate_tool_arguments({"path": "README.md", "note": {"keep": True}}, schema) == []


def test_additional_properties_false_blocks_extra_keys() -> None:
    schema = {
        "type": "object",
        "properties": {"path": {"type": "string"}},
        "additionalProperties": False,
    }

    violations = validate_tool_arguments({"path": "README.md", "extra": 7}, schema)

    assert violations == ["UNEXPECTED $.extra"]
