from __future__ import annotations

import json
from io import StringIO
from unittest.mock import patch

import pytest


def test_unit_convert_voltage(fe_engine_module):
    """Test voltage unit conversion."""
    fe_engine_module._init_unit_registry()

    input_data = json.dumps({"action": "unit_convert", "value": 120, "from_unit": "V", "to_unit": "mV"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            try:
                fe_engine_module.main()
            except SystemExit:
                pass

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "final"
    assert result["payload"]["value"] == 120000
    assert "millivolt" in result["payload"]["unit"].lower() or "mV" in result["payload"]["unit"]


def test_unit_convert_distance(fe_engine_module):
    """Test distance unit conversion."""
    fe_engine_module._init_unit_registry()

    input_data = json.dumps({"action": "unit_convert", "value": 1, "from_unit": "m", "to_unit": "cm"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            try:
                fe_engine_module.main()
            except SystemExit:
                pass

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "final"
    assert result["payload"]["value"] == 100


def test_unit_convert_temperature(fe_engine_module):
    """Test temperature unit conversion."""
    fe_engine_module._init_unit_registry()

    input_data = json.dumps({"action": "unit_convert", "value": 0, "from_unit": "degree_C", "to_unit": "degree_F"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            try:
                fe_engine_module.main()
            except SystemExit:
                pass

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "final"
    # 0°C = 32°F
    assert result["payload"]["value"] == 32


def test_unit_convert_missing_from_unit(fe_engine_module):
    """Test unit conversion without from_unit (should fail)."""
    fe_engine_module._init_unit_registry()

    input_data = json.dumps({"action": "unit_convert", "value": 120, "to_unit": "mV"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            with pytest.raises(SystemExit) as exc_info:
                fe_engine_module.main()
            assert exc_info.value.code == 1

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "error"


def test_unit_convert_invalid_value(fe_engine_module):
    """Test unit conversion with invalid value (should fail)."""
    fe_engine_module._init_unit_registry()

    input_data = json.dumps({"action": "unit_convert", "value": "not_a_number", "from_unit": "V", "to_unit": "mV"})
    output = StringIO()

    with patch("sys.stdin", StringIO(input_data)):
        with patch("sys.stdout", output):
            with pytest.raises(SystemExit) as exc_info:
                fe_engine_module.main()
            assert exc_info.value.code == 1

    result = json.loads(output.getvalue().strip())
    assert result["event"] == "error"
