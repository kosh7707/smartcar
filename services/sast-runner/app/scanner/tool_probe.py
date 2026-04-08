from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Callable


def service_toolchain_executable(name: str) -> Path | None:
    base = Path(__file__).resolve().parents[2] / ".venv" / "bin" / name
    return base if base.exists() else None


async def probe_command(
    cmd: list[str],
    *,
    version_parser: Callable[[str], str | None],
    expected_executable_path: Path | None = None,
    timeout_s: int = 10,
) -> dict[str, str | bool | None]:
    result: dict[str, str | bool | None] = {
        "available": False,
        "version": None,
        "probeReason": None,
        "expectedExecutablePath": str(expected_executable_path) if expected_executable_path else None,
    }

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_s)
        if proc.returncode == 0:
            output = stdout.decode().strip() or stderr.decode().strip()
            result["available"] = True
            result["version"] = version_parser(output)
            return result

        result["probeReason"] = "tool-check-failed"
        return result
    except FileNotFoundError:
        if expected_executable_path and expected_executable_path.exists():
            result["probeReason"] = "environment-drift"
        else:
            result["probeReason"] = "runtime-tool-missing"
        return result
    except asyncio.TimeoutError:
        result["probeReason"] = "tool-check-failed"
        return result
    except Exception:
        result["probeReason"] = "tool-check-failed"
        return result
