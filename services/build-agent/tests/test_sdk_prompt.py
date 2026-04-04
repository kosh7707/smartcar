from app.routers.tasks import _build_sdk_analyze_prompt


def test_sdk_prompt_uses_list_files_before_read_file():
    prompt = _build_sdk_analyze_prompt("/tmp/sdk")

    assert "반드시 첫 동작은 `list_files`" in prompt
    assert "디렉토리 탐색을 위해 `try_build`로 `ls` 같은 셸 명령을 실행하지 마라." in prompt
    assert "도구가 반환한 refId만" in prompt
