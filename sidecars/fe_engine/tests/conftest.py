from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest


@pytest.fixture
def fe_engine_module():
    module_path = Path(__file__).resolve().parents[1] / "main.py"
    spec = importlib.util.spec_from_file_location("fe_engine_main", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("failed to load fe_engine main.py for tests")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
