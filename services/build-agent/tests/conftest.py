import pytest
from fastapi.testclient import TestClient

from agent_shared.schemas.agent import BudgetState


@pytest.fixture
def client():
    from app.config import settings

    original_mode = settings.llm_mode
    object.__setattr__(settings, "llm_mode", "mock")
    from app.main import app
    try:
        yield TestClient(app)
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.fixture
def budget_state():
    return BudgetState(
        max_steps=10,
        max_completion_tokens=20000,
        max_cheap_calls=20,
        max_medium_calls=5,
        max_expensive_calls=5,
        max_consecutive_no_evidence=6,
    )


@pytest.fixture
def tmp_project_dir(tmp_path):
    (tmp_path / "CMakeLists.txt").write_text("cmake_minimum_required(VERSION 3.10)")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.c").write_text('#include <stdio.h>\nint main() { return 0; }')
    return tmp_path
