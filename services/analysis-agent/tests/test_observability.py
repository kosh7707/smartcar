import json
import logging

from agent_shared.observability import _JsonFormatter


def test_json_formatter_emits_aegis_numeric_log_levels():
    formatter = _JsonFormatter("s3-agent")
    record = logging.LogRecord(
        name="test",
        level=logging.WARNING,
        pathname=__file__,
        lineno=1,
        msg="watch this",
        args=(),
        exc_info=None,
    )

    data = json.loads(formatter.format(record))

    assert data["level"] == 40
    assert data["service"] == "s3-agent"
    assert data["msg"] == "watch this"
