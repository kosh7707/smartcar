"""BuildErrorClassifier 단위 테스트 — 빌드 에러 분류 + 복구 제안."""

from app.pipeline.build_error_classifier import (
    BuildErrorCategory,
    BuildErrorClassification,
    classify_build_error,
)


def test_classify_missing_header():
    output = "src/main.c:5:10: fatal error: mqtt.h: No such file or directory"
    results = classify_build_error(output)
    assert len(results) >= 1
    assert results[0].category == BuildErrorCategory.MISSING_HEADER
    assert "mqtt.h" in results[0].suggestion


def test_classify_missing_header_variant():
    output = "src/net.c:1:10: error: 'openssl/ssl.h' file not found"
    results = classify_build_error(output)
    assert len(results) >= 1
    assert results[0].category == BuildErrorCategory.MISSING_HEADER


def test_classify_undefined_symbol():
    output = "/usr/bin/ld: main.o: undefined reference to `mqtt_connect'"
    results = classify_build_error(output)
    assert len(results) >= 1
    assert results[0].category == BuildErrorCategory.UNDEFINED_SYMBOL
    assert "mqtt_connect" in results[0].suggestion


def test_classify_toolchain_not_found():
    output = "bash: arm-none-linux-gnueabihf-gcc: command not found"
    results = classify_build_error(output)
    assert len(results) >= 1
    assert results[0].category == BuildErrorCategory.TOOLCHAIN_NOT_FOUND
    assert "SDK" in results[0].suggestion or "environment-setup" in results[0].suggestion


def test_classify_permission_denied():
    output = "bash: ./build.sh: Permission denied"
    results = classify_build_error(output)
    assert len(results) >= 1
    assert results[0].category == BuildErrorCategory.PERMISSION_DENIED
    assert "bash" in results[0].suggestion


def test_classify_syntax_error():
    output = "src/main.c:42:1: error: expected ';' before 'return'"
    results = classify_build_error(output)
    assert len(results) >= 1
    assert results[0].category == BuildErrorCategory.SYNTAX_ERROR


def test_classify_missing_library():
    output = "/usr/bin/ld: cannot find -lssl"
    results = classify_build_error(output)
    assert len(results) >= 1
    assert results[0].category == BuildErrorCategory.MISSING_LIBRARY
    assert "ssl" in results[0].suggestion


def test_classify_cmake_error():
    output = "CMake Error at CMakeLists.txt:15 (find_package):\n  Could not find package"
    results = classify_build_error(output)
    assert len(results) >= 1
    assert results[0].category == BuildErrorCategory.CMAKE_CONFIG_ERROR


def test_classify_file_not_found():
    output = "gcc: error: /opt/missing/lib.a: No such file or directory"
    results = classify_build_error(output)
    assert len(results) >= 1
    assert results[0].category == BuildErrorCategory.FILE_NOT_FOUND


def test_classify_multiple_errors():
    output = (
        "src/main.c:5:10: fatal error: mqtt.h: No such file or directory\n"
        "/usr/bin/ld: cannot find -lssl\n"
        "bash: arm-none-linux-gnueabihf-gcc: command not found\n"
    )
    results = classify_build_error(output)
    categories = {r.category for r in results}
    assert BuildErrorCategory.MISSING_HEADER in categories
    assert BuildErrorCategory.MISSING_LIBRARY in categories
    assert BuildErrorCategory.TOOLCHAIN_NOT_FOUND in categories


def test_classify_clean_output():
    output = "Build completed successfully.\n7 compilation units.\nExit code: 0"
    results = classify_build_error(output)
    assert len(results) == 0


def test_classify_empty_output():
    results = classify_build_error("")
    assert len(results) == 0
