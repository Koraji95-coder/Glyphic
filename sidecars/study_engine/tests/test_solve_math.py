from __future__ import annotations

import io
import json
from unittest.mock import patch

import pytest


def _run_request(m, req):
    events = []
    with patch.object(m, "respond", side_effect=lambda obj: events.append(obj)):
        m.handle_request(req)
    return events


def _run_request_expect_exit(m, req):
    events = []
    with patch.object(m, "respond", side_effect=lambda obj: events.append(obj)):
        with pytest.raises(SystemExit) as exc:
            m.handle_request(req)
    return events, exc.value.code


def _run_main_expect_exit(m, req):
    events = []
    with patch.object(m, "respond", side_effect=lambda obj: events.append(obj)):
        with patch.object(m.sys, "stdin", io.StringIO(json.dumps(req) + "\n")):
            with pytest.raises(SystemExit) as exc:
                m.main()
    return events, exc.value.code


_SOLUTION = (
    "**Step 1:** Apply Ohm's law: $V = IR$\n\n"
    "$I = \\frac{V}{R} = \\frac{50}{10} = 5\\,\\text{A}$\n\n"
    "**Answer:** $I = 5\\,\\text{A}$"
)

_VALID_REQ = {
    "action": "solve_math",
    "problem": "Find the current through a 10 Ω resistor with 50 V across it.",
    "endpoint": "http://127.0.0.1:11434",
    "model": "llama3.1:8b",
}


def test_solve_math_happy_path(study_engine_module):
    with patch.object(study_engine_module, "_ollama_chat", return_value=_SOLUTION):
        events = _run_request(study_engine_module, _VALID_REQ)

    assert events[-1]["event"] == "final"
    assert events[-1]["payload"]["solution"] == _SOLUTION


def test_solve_math_missing_problem(study_engine_module):
    req = {**_VALID_REQ, "problem": ""}
    events, code = _run_request_expect_exit(study_engine_module, req)
    assert code == 1
    assert events[-1]["event"] == "error"
    assert "non-empty problem" in events[-1]["message"]


def test_solve_math_missing_endpoint(study_engine_module):
    req = {**_VALID_REQ, "endpoint": ""}
    events, code = _run_request_expect_exit(study_engine_module, req)
    assert code == 1
    assert events[-1]["event"] == "error"
    assert "endpoint" in events[-1]["message"]


def test_solve_math_missing_model(study_engine_module):
    req = {**_VALID_REQ, "model": ""}
    events, code = _run_request_expect_exit(study_engine_module, req)
    assert code == 1
    assert events[-1]["event"] == "error"
    assert "model" in events[-1]["message"]


def test_solve_math_llm_unavailable(study_engine_module):
    with patch.object(
        study_engine_module,
        "_ollama_chat",
        side_effect=RuntimeError("connection refused"),
    ):
        events, code = _run_main_expect_exit(study_engine_module, _VALID_REQ)
    assert code == 1
    assert events[-1]["event"] == "error"
    assert "connection refused" in events[-1]["message"]
