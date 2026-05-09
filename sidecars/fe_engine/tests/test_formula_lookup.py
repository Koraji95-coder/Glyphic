from __future__ import annotations

import json
from io import StringIO
from unittest.mock import patch

import pytest


def test_formula_lookup_by_query(fe_engine_module):
    """Test formula lookup by search query."""
    fe_engine_module._load_formulas()

    input_data = json.dumps({"action": "formula_lookup", "query": "ohm"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            try:
                fe_engine_module.main()
            except SystemExit:
                pass

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "final"
    assert "formulas" in result["payload"]
    assert len(result["payload"]["formulas"]) > 0

    # Check that we found Ohm's Law
    names = [f["name"] for f in result["payload"]["formulas"]]
    assert any("Ohm" in name for name in names)


def test_formula_lookup_by_topic(fe_engine_module):
    """Test formula lookup filtered by topic."""
    fe_engine_module._load_formulas()

    input_data = json.dumps({"action": "formula_lookup", "topic": "circuit_analysis", "query": "voltage"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            try:
                fe_engine_module.main()
            except SystemExit:
                pass

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "final"
    assert "formulas" in result["payload"]

    # All results should be from circuit_analysis topic
    for formula in result["payload"]["formulas"]:
        assert formula["topic"] == "circuit_analysis"


def test_formula_lookup_missing_query(fe_engine_module):
    """Test formula lookup without query (should fail)."""
    fe_engine_module._load_formulas()

    input_data = json.dumps({"action": "formula_lookup"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            with pytest.raises(SystemExit) as exc_info:
                fe_engine_module.main()
            assert exc_info.value.code == 1

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "error"
    assert "query" in result["message"].lower()


def test_formula_lookup_no_results(fe_engine_module):
    """Test formula lookup with no matches."""
    fe_engine_module._load_formulas()

    input_data = json.dumps({"action": "formula_lookup", "query": "nonexistent_formula_xyz"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            try:
                fe_engine_module.main()
            except SystemExit:
                pass

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "final"
    assert result["payload"]["formulas"] == []
