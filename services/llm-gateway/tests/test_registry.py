from app.registry.model_registry import ModelProfile, ModelProfileRegistry
from app.registry.prompt_registry import (
    PromptEntry,
    PromptRegistry,
    create_default_registry,
)
from app.types import TaskType


# --- PromptRegistry ---

def test_prompt_register_and_get():
    registry = PromptRegistry()
    entry = PromptEntry(
        promptId="test", version="v1", taskType=TaskType.STATIC_EXPLAIN,
        description="test", systemTemplate="sys", userTemplate="usr",
    )
    registry.register(entry)

    assert registry.get(TaskType.STATIC_EXPLAIN) is entry


def test_prompt_get_missing():
    registry = PromptRegistry()
    assert registry.get(TaskType.STATIC_EXPLAIN) is None


def test_prompt_list_all():
    registry = PromptRegistry()
    registry.register(PromptEntry(
        promptId="a", version="v1", taskType=TaskType.STATIC_EXPLAIN,
        description="desc-a", systemTemplate="", userTemplate="",
    ))
    registry.register(PromptEntry(
        promptId="b", version="v2", taskType=TaskType.DYNAMIC_ANNOTATE,
        description="desc-b", systemTemplate="", userTemplate="",
    ))

    items = registry.list_all()
    assert len(items) == 2
    assert items[0]["promptId"] == "a"
    assert items[1]["version"] == "v2"


def test_prompt_overwrite():
    registry = PromptRegistry()
    entry_v1 = PromptEntry(
        promptId="test", version="v1", taskType=TaskType.STATIC_EXPLAIN,
        description="old", systemTemplate="", userTemplate="",
    )
    entry_v2 = PromptEntry(
        promptId="test", version="v2", taskType=TaskType.STATIC_EXPLAIN,
        description="new", systemTemplate="", userTemplate="",
    )
    registry.register(entry_v1)
    registry.register(entry_v2)

    assert registry.get(TaskType.STATIC_EXPLAIN).version == "v2"


def test_default_registry_has_all_task_types():
    registry = create_default_registry()
    for task_type in TaskType:
        entry = registry.get(task_type)
        assert entry is not None, f"Missing prompt for {task_type}"
        assert entry.systemTemplate
        assert entry.userTemplate


# --- ModelProfileRegistry ---

def _make_profile(profile_id: str = "test-model") -> ModelProfile:
    return ModelProfile(
        profileId=profile_id,
        modelName="qwen3:32b",
        contextLimit=8192,
        allowedTaskTypes=list(TaskType),
    )


def test_model_register_and_get():
    registry = ModelProfileRegistry()
    profile = _make_profile()
    registry.register(profile)

    assert registry.get("test-model") is profile


def test_model_get_missing():
    registry = ModelProfileRegistry()
    assert registry.get("nonexistent") is None


def test_model_first_registered_is_default():
    registry = ModelProfileRegistry()
    p1 = _make_profile("model-a")
    p2 = _make_profile("model-b")
    registry.register(p1)
    registry.register(p2)

    assert registry.get_default() is p1


def test_model_explicit_default():
    registry = ModelProfileRegistry()
    p1 = _make_profile("model-a")
    p2 = _make_profile("model-b")
    registry.register(p1)
    registry.register(p2, default=True)

    assert registry.get_default() is p2


def test_model_no_profiles():
    registry = ModelProfileRegistry()
    assert registry.get_default() is None


def test_model_list_all():
    registry = ModelProfileRegistry()
    registry.register(_make_profile("m1"))
    registry.register(_make_profile("m2"))

    items = registry.list_all()
    assert len(items) == 2
    assert items[0]["profileId"] == "m1"
    assert "allowedTaskTypes" in items[0]


def test_model_allowed_task_types_serialized():
    registry = ModelProfileRegistry()
    profile = ModelProfile(
        profileId="limited",
        modelName="test",
        contextLimit=4096,
        allowedTaskTypes=[TaskType.STATIC_EXPLAIN, TaskType.REPORT_DRAFT],
    )
    registry.register(profile)

    items = registry.list_all()
    assert "static-explain" in items[0]["allowedTaskTypes"]
    assert "report-draft" in items[0]["allowedTaskTypes"]
