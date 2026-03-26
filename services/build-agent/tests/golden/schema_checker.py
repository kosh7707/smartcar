"""Golden fixture schema checker.

Recursively validates actual response dicts against golden fixture templates.
Type markers in the golden fixture define expected types:
  __STRING__       -> str
  __INT__          -> int
  __FLOAT__        -> float
  __BOOL__         -> bool
  __LIST__         -> list
  __DICT__         -> dict
  __DICT_OR_NULL__ -> dict | None
  __FLOAT_0_1__    -> float in [0, 1]
"""

from __future__ import annotations

_TYPE_MAP: dict[str, type | tuple[type, ...]] = {
    "__STRING__": str,
    "__INT__": int,
    "__FLOAT__": float,
    "__BOOL__": bool,
    "__LIST__": list,
    "__DICT__": dict,
}


def check_schema(actual: dict, golden: dict, *, path: str = "$") -> list[str]:
    """Compare *actual* dict against *golden* fixture template.

    Returns a list of human-readable violation strings.  An empty list
    means the actual dict conforms to the golden schema.
    """
    violations: list[str] = []

    for key, expected in golden.items():
        full_path = f"{path}.{key}"

        if key not in actual:
            violations.append(f"MISSING key: {full_path}")
            continue

        value = actual[key]
        _check_value(value, expected, full_path, violations)

    return violations


def _check_value(
    value: object,
    expected: object,
    path: str,
    violations: list[str],
) -> None:
    """Check a single value against its golden expectation."""

    if isinstance(expected, str):
        # --- Scalar type markers ---
        if expected == "__FLOAT_0_1__":
            if not isinstance(value, (int, float)):
                violations.append(
                    f"TYPE {path}: expected float in [0,1], got {type(value).__name__}"
                )
            elif not (0.0 <= float(value) <= 1.0):
                violations.append(
                    f"RANGE {path}: expected float in [0,1], got {value}"
                )
            return

        if expected == "__DICT_OR_NULL__":
            if value is not None and not isinstance(value, dict):
                violations.append(
                    f"TYPE {path}: expected dict|None, got {type(value).__name__}"
                )
            return

        expected_type = _TYPE_MAP.get(expected)
        if expected_type is not None:
            if not isinstance(value, expected_type):
                violations.append(
                    f"TYPE {path}: expected {expected_type.__name__}, "
                    f"got {type(value).__name__}"
                )
            return

        # Not a marker -- treat as literal string match (unused in current
        # golden fixtures but supported for completeness).
        if value != expected:
            violations.append(
                f"VALUE {path}: expected {expected!r}, got {value!r}"
            )
        return

    if isinstance(expected, dict):
        if not isinstance(value, dict):
            violations.append(
                f"TYPE {path}: expected dict, got {type(value).__name__}"
            )
            return
        violations.extend(check_schema(value, expected, path=path))
        return

    if isinstance(expected, list):
        if not isinstance(value, list):
            violations.append(
                f"TYPE {path}: expected list, got {type(value).__name__}"
            )
            return
        # If the golden list has a template element, validate each actual
        # element against it.
        if len(expected) == 1:
            template = expected[0]
            for i, item in enumerate(value):
                _check_value(item, template, f"{path}[{i}]", violations)
        return
