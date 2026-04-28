from app.routers.sdk_analyze_support import build_sdk_analyze_prompt


def test_sdk_prompt_uses_list_files_before_read_file():
    prompt = build_sdk_analyze_prompt("/tmp/sdk")

    assert "반드시 첫 동작은 `list_files`" in prompt
    assert "디렉토리 탐색을 위해 `try_build`로 `ls` 같은 셸 명령을 실행하지 마라." in prompt
    assert "도구가 반환한 refId만" in prompt


def test_build_resolve_prompt_uses_thinking_on_wording_without_no_think_suffix():
    from app.routers.build_route_support import build_system_prompt

    prompt = build_system_prompt(
        build_material={},
        build_files=[],
        project_path="/tmp/project",
        build_subdir="build-aegis-test",
    )
    forbidden = "/no" + "_think"

    assert forbidden not in prompt
    assert "thinking/reasoning" in prompt
    assert "최종 content는 아래 순수 JSON만 포함" in prompt
