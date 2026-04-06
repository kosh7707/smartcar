from pathlib import Path


def test_sdk_analyze_uses_deterministic_profile_extraction(client, tmp_path):
    sdk_root = tmp_path / "ti-am335x"
    env_dir = sdk_root / "linux-devkit"
    compiler_dir = env_dir / "sysroots" / "x86_64-arago-linux" / "usr" / "bin"
    compiler_dir.mkdir(parents=True)

    env_script = env_dir / "environment-setup-armv7at2hf-neon-linux-gnueabi"
    env_script.write_text(
        "\n".join(
            [
                'export SDKTARGETSYSROOT="/opt/ti/sysroot"',
                'export CC="/opt/ti/bin/arm-none-linux-gnueabihf-gcc -march=armv7-a"',
                'export CFLAGS="-D__ARM_ARCH=7 -I/opt/ti/sysroot/usr/include -std=gnu11"',
            ]
        ),
        encoding="utf-8",
    )

    compiler = compiler_dir / "arm-none-linux-gnueabihf-gcc"
    compiler.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    compiler.chmod(0o755)

    resp = client.post(
        "/v1/tasks",
        json={
            "taskType": "sdk-analyze",
            "taskId": "sdk-deterministic-001",
            "context": {"trusted": {"projectPath": str(sdk_root)}},
        },
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["taskType"] == "sdk-analyze"
    assert data["result"]["sdkProfile"]["compilerPrefix"] == "arm-none-linux-gnueabihf"
    assert data["result"]["sdkProfile"]["targetArch"] == "armv7-a"
    assert data["result"]["sdkProfile"]["languageStandard"] == "gnu11"
    assert data["result"]["sdkProfile"]["environmentSetup"] == "linux-devkit/environment-setup-armv7at2hf-neon-linux-gnueabi"
    assert data["result"]["sdkProfile"]["includePaths"] == ["/opt/ti/sysroot/usr/include"]
    assert data["result"]["sdkProfile"]["defines"]["__ARM_ARCH"] == "7"


def test_sdk_analyze_matches_relative_cc_to_discovered_compiler(client, tmp_path):
    sdk_root = tmp_path / "ti-am335x"
    env_dir = sdk_root / "linux-devkit"
    compiler_dir = env_dir / "sysroots" / "x86_64-arago-linux" / "usr" / "bin"
    compiler_dir.mkdir(parents=True)

    env_script = env_dir / "environment-setup-armv7at2hf-neon-linux-gnueabi"
    env_script.write_text(
        '\n'.join(
            [
                'export CC="arm-none-linux-gnueabihf-gcc -march=armv7-a"',
                'export CFLAGS="-std=c11"',
            ]
        ),
        encoding="utf-8",
    )

    compiler = compiler_dir / "arm-none-linux-gnueabihf-gcc"
    compiler.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    compiler.chmod(0o755)

    resp = client.post(
        "/v1/tasks",
        json={
            "taskType": "sdk-analyze",
            "taskId": "sdk-deterministic-002",
            "context": {"trusted": {"projectPath": str(sdk_root)}},
        },
    )

    data = resp.json()
    assert resp.status_code == 200
    assert data["status"] == "completed"
    assert data["result"]["sdkProfile"]["compiler"] == str(compiler)
    assert data["result"]["sdkProfile"]["compilerPrefix"] == "arm-none-linux-gnueabihf"
