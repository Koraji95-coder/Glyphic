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


_PROBLEMS_JSON = (
    '[{"statement": "Calculate $R$ given $V=12\\,\\text{V}$, $I=2\\,\\text{A}$.", '
    '"answer": "$R = 6\\,\\Omega$"}]'
)

_VALID_REQ = {
    "action": "generate_problems",
    "topic": "Ohm\'s law",
    "difficulty": "easy",
    "count": 1,
    "endpoint": "http://127.0.0.1:11434",
    "model": "llama3.1:8b",
}


def test_generate_problems_happy_path(study_engine_module):
    with patch.object(study_engine_module, "_ollama_chat", return_value=_PROBLEMS_JSON):
        events = _run_request(study_engine_module, _VALID_REQ)

    assert events[-1]["event"] == "final"
    problems = events[-1]["payload"]["problems"]
    assert isinstance(problems, list)
    assert len(problems) == 1
    assert "statement" in problems[0]
    assert "answer" in problems[0]


def test_generate_problems_fenced_json(study_engine_module):
    fenced = "```json\n" + _PROBLEMS_JSON + "\n```"
    with patch.object(study_engine_module, "_ollama_chat", return_value=fenced):
        events = _run_request(study_engine_module, _VALID_REQ)

    assert events[-1]["event"] == "final"
    assert isinstance(events[-1]["payload"]["problems"], list)


def test_generate_problems_default_count_and_difficulty(study_engine_module):
    """Omitting count and difficulty should use defaults (5 and 'medium')."""
    req = {
        "action": "generate_problems",
        "topic": "statics",
        "endpoint": "http://127.0.0.1:11434",
        "model": "llama3.1:8b",
    }
    captured_args: list = []

    def fake_chat(endpoint, model, system_prompt, user_content):
        captured_args.append(user_content)
        return _PROBLEMS_JSON

    with patch.object(study_engine_module, "_ollama_chat", side_effect=fake_chat):
        events = _run_request(study_engine_module, req)

    assert events[-1]["event"] == "final"
    assert "medium" in captured_args[0]
    assert "5" in captured_args[0]


def test_generate_problems_missing_topic(study_engine_module):
    req = {**_VALID_REQ, "topic": ""}
    events, code = _run_request_expect_exit(study_engine_module, req)
    assert code == 1
    assert events[-1]["event"] == "error"
    assert "topic" in events[-1]["message"]


def test_generate_problems_invalid_difficulty(study_engine_module):
    req = {**_VALID_REQ, "difficulty": "extreme"}
    events, code = _run_request_expect_exit(study_engine_module, req)
    assert code == 1
    assert events[-1]["event"] == "error"
    assert "difficulty" in events[-1]["message"]


def test_generate_problems_invalid_count(study_engine_module):
    req = {**_VALID_REQ, "count": 0}
    events, code = _run_request_expect_exit(study_engine_module, req)
    assert code == 1
    assert events[-1]["event"] == "error"
    assert "count" in events[-1]["message"]


def test_generate_problems_llm_unavailable(study_engine_module):
    with patch.object(
        study_engine_module,
        "_ollama_chat",
        side_effect=RuntimeError("connection refused"),
    ):
        events, code = _run_main_expect_exit(study_engine_module, _VALID_REQ)
    assert code == 1
    assert events[-1]["event"] == "error"
    assert "connection refused" in events[-1]["message"]


def test_generate_problems_non_json_fallback(study_engine_module):
    """If the LLM returns prose instead of JSON the fallback wraps it safely."""
    with patch.object(
        study_engine_module,
        "_ollama_chat",
        return_value="Here are some problems for you: 1) ...",
    ):
        events = _run_request(study_engine_module, _VALID_REQ)

    assert events[-1]["event"] == "final"
    problems = events[-1]["payload"]["problems"]
    assert isinstance(problems, list)
    assert len(problems) == 1
    assert problems[0]["statement"] != ""
