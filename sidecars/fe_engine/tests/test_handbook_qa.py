from __future__ import annotations

import json
from io import StringIO
from unittest.mock import patch

import pytest


def test_handbook_qa_formula_question(fe_engine_module):
    """Test handbook Q&A with formula-related question."""
    input_data = json.dumps({"action": "handbook_qa", "question": "What formulas are in the handbook?"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            try:
                fe_engine_module.main()
            except SystemExit:
                pass

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "final"
    assert "answer" in result["payload"]
    assert "citations" in result["payload"]
    assert isinstance(result["payload"]["answer"], str)
    assert len(result["payload"]["answer"]) > 0


def test_handbook_qa_unit_question(fe_engine_module):
    """Test handbook Q&A with unit conversion question."""
    input_data = json.dumps({"action": "handbook_qa", "question": "How do I convert units?"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            try:
                fe_engine_module.main()
            except SystemExit:
                pass

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "final"
    assert "SI" in result["payload"]["answer"] or "unit" in result["payload"]["answer"]


def test_handbook_qa_generic_question(fe_engine_module):
    """Test handbook Q&A with generic question."""
    input_data = json.dumps({"action": "handbook_qa", "question": "What is in the handbook?"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            try:
                fe_engine_module.main()
            except SystemExit:
                pass

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "final"
    assert "answer" in result["payload"]
    assert len(result["payload"]["citations"]) > 0


def test_handbook_qa_missing_question(fe_engine_module):
    """Test handbook Q&A without question (should fail)."""
    input_data = json.dumps({"action": "handbook_qa"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            with pytest.raises(SystemExit) as exc_info:
                fe_engine_module.main()
            assert exc_info.value.code == 1

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "error"
    assert "question" in result["message"].lower()
