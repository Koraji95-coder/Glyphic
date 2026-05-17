from __future__ import annotations

from unittest.mock import patch

import pytest


def _run_generate(diagram_engine_module, req):
    events = []
    with patch.object(diagram_engine_module, "respond", side_effect=lambda obj: events.append(obj)):
        diagram_engine_module.handle_request(req)
    return events


def _run_generate_expect_exit(diagram_engine_module, req):
    events = []
    with patch.object(diagram_engine_module, "respond", side_effect=lambda obj: events.append(obj)):
        with pytest.raises(SystemExit) as exc:
            diagram_engine_module.handle_request(req)
    return events, exc.value.code


def test_generate_code_happy_path_mermaid(diagram_engine_module, mocked_ollama):
    with mocked_ollama(return_value="flowchart TD\nA[Start] --> B[End]"):
        events = _run_generate(
            diagram_engine_module,
            {"action": "generate_code", "description": "simple start/end flow", "diagram_type": "mermaid"},
        )

    assert [event["event"] for event in events] == ["progress", "progress", "progress", "final"]
    final = events[-1]
    assert final["language"] == "mermaid"
    assert final["diagram_type"] == "mermaid"
    assert "flowchart TD" in final["code"]


def test_generate_code_happy_path_python(diagram_engine_module, mocked_ollama):
    python_code = "import schemdraw.elements as elm\nd = schemdraw.Drawing()\nd += elm.Resistor()"
    with mocked_ollama(return_value=python_code):
        events = _run_generate(
            diagram_engine_module,
            {"action": "generate_code", "description": "draw a resistor circuit", "diagram_type": "schemdraw"},
        )

    final = events[-1]
    assert final["event"] == "final"
    assert final["language"] == "python"
    assert final["diagram_type"] == "schemdraw"
    assert "schemdraw.Drawing()" in final["code"]


def test_generate_code_auto_type_selection(diagram_engine_module, mocked_ollama):
    llm_json = (
        '{"diagram_type":"schemdraw","language":"python","code":"import schemdraw.elements as elm\\n'
        'd = schemdraw.Drawing()\\nd += elm.SourceV()"}'
    )
    with mocked_ollama(return_value=llm_json):
        events = _run_generate(
            diagram_engine_module,
            {"action": "generate_code", "description": "a simple battery and resistor circuit", "diagram_type": "auto"},
        )

    final = events[-1]
    assert final["event"] == "final"
    assert final["diagram_type"] == "schemdraw"
    assert final["language"] == "python"


def test_generate_code_missing_description(diagram_engine_module):
    events, code = _run_generate_expect_exit(
        diagram_engine_module,
        {"action": "generate_code", "diagram_type": "mermaid"},
    )
    assert code == 1
    assert events[-1]["event"] == "error"
    assert "description is required" in events[-1]["message"]


def test_generate_code_llm_unavailable(diagram_engine_module, mocked_ollama):
    with mocked_ollama(side_effect=RuntimeError("connection refused")):
        events = _run_generate(
            diagram_engine_module,
            {"action": "generate_code", "description": "flow", "diagram_type": "mermaid"},
        )
    assert events[-1]["event"] == "final"
    assert events[-1]["diagram_type"] == "mermaid"
    assert "flowchart TD" in events[-1]["code"]
    assert any("connection refused" in warning for warning in events[-1]["warnings"])


def test_generate_code_validation_retry_success(diagram_engine_module, mocked_ollama):
    with mocked_ollama(side_effect=["nonsense output", "flowchart TD\nA --> B"]):
        events = _run_generate(
            diagram_engine_module,
            {"action": "generate_code", "description": "flow from A to B", "diagram_type": "mermaid"},
        )

    final = events[-1]
    assert final["event"] == "final"
    assert final["warnings"]
    assert final["diagram_type"] == "mermaid"


def test_generate_code_validation_retry_failure(diagram_engine_module, mocked_ollama):
    with mocked_ollama(side_effect=["still wrong", "still wrong again", "wrong 3", "wrong 4"]):
        events = _run_generate(
            diagram_engine_module,
            {"action": "generate_code", "description": "flow from A to B", "diagram_type": "mermaid"},
        )
    assert events[-1]["event"] == "final"
    assert events[-1]["diagram_type"] == "mermaid"
    assert "flowchart TD" in events[-1]["code"]
    assert any("fallback applied" in warning for warning in events[-1]["warnings"])
