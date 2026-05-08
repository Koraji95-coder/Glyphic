from __future__ import annotations

import json
import io
from unittest.mock import patch

import pytest


def _run_request(study_engine_module, req):
    events = []
    with patch.object(study_engine_module, "respond", side_effect=lambda obj: events.append(obj)):
        study_engine_module.handle_request(req)
    return events


def _run_request_expect_exit(study_engine_module, req):
    events = []
    with patch.object(study_engine_module, "respond", side_effect=lambda obj: events.append(obj)):
        with pytest.raises(SystemExit) as exc:
            study_engine_module.handle_request(req)
    return events, exc.value.code


def _run_main_expect_exit(study_engine_module, req):
    events = []
    with patch.object(study_engine_module, "respond", side_effect=lambda obj: events.append(obj)):
        with patch.object(study_engine_module.sys, "stdin", io.StringIO(json.dumps(req) + "\n")):
            with pytest.raises(SystemExit) as exc:
                study_engine_module.main()
    return events, exc.value.code


def test_study_ask_happy_path(study_engine_module):
    with patch.object(study_engine_module, "_ollama_chat", return_value="Use Ohm's law."):
        events = _run_request(
            study_engine_module,
            {
                "action": "study_ask",
                "question": "Find current through 10Ω with 50V",
                "endpoint": "http://127.0.0.1:11434",
                "model": "llama3.1:8b",
                "sources": [{"text": "I = V/R", "source_label": "circuits-note"}],
            },
        )

    assert events[-1]["event"] == "final"
    assert events[-1]["payload"]["answer"] == "Use Ohm's law."


def test_grade_math_answer_happy_path(study_engine_module):
    with patch.object(
        study_engine_module,
        "_ollama_chat",
        return_value='{"verdict":"partial","score":70,"feedback":"Good setup, arithmetic error."}',
    ):
        events = _run_request(
            study_engine_module,
            {
                "action": "grade_math_answer",
                "problem": "2+2?",
                "user_answer": "5",
                "correct_answer": "4",
                "endpoint": "http://127.0.0.1:11434",
                "model": "llama3.1:8b",
            },
        )

    assert events[-1]["event"] == "final"
    assert events[-1]["payload"]["verdict"] == "partial"
    assert events[-1]["payload"]["score"] == 70


def test_study_ask_missing_question_errors(study_engine_module):
    events, code = _run_request_expect_exit(
        study_engine_module,
        {
            "action": "study_ask",
            "question": "",
            "endpoint": "http://127.0.0.1:11434",
            "model": "llama3.1:8b",
        },
    )
    assert code == 1
    assert events[-1]["event"] == "error"
    assert "non-empty question" in events[-1]["message"]


def test_grade_math_answer_llm_unavailable(study_engine_module):
    with patch.object(study_engine_module, "_ollama_chat", side_effect=RuntimeError("connection refused")):
        events, code = _run_main_expect_exit(
            study_engine_module,
            {
                "action": "grade_math_answer",
                "problem": "2+2?",
                "user_answer": "5",
                "correct_answer": "4",
                "endpoint": "http://127.0.0.1:11434",
                "model": "llama3.1:8b",
            },
        )
    assert code == 1
    assert events[-1]["event"] == "error"
    assert "connection refused" in events[-1]["message"]
