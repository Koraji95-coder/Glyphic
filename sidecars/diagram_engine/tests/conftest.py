from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from unittest.mock import patch


@pytest.fixture
def diagram_engine_module():
    module_path = Path(__file__).resolve().parents[1] / "main.py"
    spec = importlib.util.spec_from_file_location("diagram_engine_main", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("failed to load diagram_engine main.py for tests")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def tmp_workdir(tmp_path: Path) -> Path:
    return tmp_path


@pytest.fixture
def mocked_ollama(diagram_engine_module):
    def _factory(*, side_effect=None, return_value=None):
        kwargs = {}
        if side_effect is not None:
            kwargs["side_effect"] = side_effect
        if return_value is not None:
            kwargs["return_value"] = return_value
        return patch.object(diagram_engine_module, "_ollama_generate", **kwargs)

    return _factory
