#!/usr/bin/env python3
"""
Glyphic FE Engine
=================

Sidecar for FE exam prep reference actions. Communicates via newline-delimited JSON
on stdin/stdout. Every response is flushed immediately.

Actions:
  formula_lookup
    topic: str (optional) — filter by topic (e.g., "circuit_analysis", "thermodynamics")
    query: str — search term in formula name or description
    Final: {"event":"final","payload":{"formulas":[{...}]}}

  unit_convert
    value: float — numeric value to convert
    from_unit: str — source unit (e.g., "V", "mV", "degree_C", "degree_F")
    to_unit: str — target unit (e.g., "mV", "V", "degree_F", "Kelvin")
    Final: {"event":"final","payload":{"value": <number>, "unit": "<unit>"}}

  handbook_qa
    question: str — question about the FE handbook / formulas
    Final: {"event":"final","payload":{"answer": "<answer>", "citations": ["<source>", ...]}}

On success:
  {"event":"final","payload":{...}}
On error:
  {"event":"error","message":"..."} and exits with status 1.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

try:
    from pint import UnitRegistry
except ImportError:
    UnitRegistry = None

# ─────────────────────────────────────────────────────────────────────────────
# Global state (initialized on module load)
# ─────────────────────────────────────────────────────────────────────────────

FORMULAS_DATA: dict[str, Any] = {}
UNIT_REGISTRY: Any = None


def _load_formulas() -> None:
    """Load formulas from formulas.json into global state."""
    global FORMULAS_DATA
    formulas_path = Path(__file__).resolve().parent / "formulas.json"
    if not formulas_path.exists():
        raise RuntimeError(f"formulas.json not found at {formulas_path}")
    with open(formulas_path, encoding="utf-8") as f:
        FORMULAS_DATA = json.load(f)


def _init_unit_registry() -> None:
    """Initialize pint unit registry."""
    global UNIT_REGISTRY
    if UnitRegistry is None:
        raise RuntimeError("pint library not installed; run: pip install -r Requirements.txt")
    UNIT_REGISTRY = UnitRegistry()


def respond(obj: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def emit_event(event: str, **payload: Any) -> None:
    respond({"event": event, **payload})


# ─────────────────────────────────────────────────────────────────────────────
# Action handlers
# ─────────────────────────────────────────────────────────────────────────────


def handle_formula_lookup(req: dict[str, Any]) -> None:
    """Search formulas by topic and/or query string."""
    topic = str(req.get("topic", "")).strip().lower()
    query = str(req.get("query", "")).strip().lower()

    if not query:
        emit_event("error", message="formula_lookup requires a non-empty query")
        raise SystemExit(1)

    results = []
    for formula in FORMULAS_DATA.get("formulas", []):
        # Filter by topic if specified
        if topic and formula.get("topic", "").lower() != topic:
            continue

        # Filter by query matching name or description
        name = formula.get("name", "").lower()
        description = formula.get("description", "").lower()
        if query in name or query in description:
            results.append(
                {
                    "id": formula.get("id"),
                    "name": formula.get("name"),
                    "formula_latex": formula.get("formula_latex"),
                    "variables": formula.get("variables", {}),
                    "description": formula.get("description"),
                    "topic": formula.get("topic"),
                    "handbook_page": formula.get("handbook_page"),
                }
            )

    emit_event("final", payload={"formulas": results})


def handle_unit_convert(req: dict[str, Any]) -> None:
    """Convert between units using pint."""
    if UNIT_REGISTRY is None:
        emit_event("error", message="unit conversion not initialized")
        raise SystemExit(1)

    try:
        value_raw = req.get("value")
        from_unit = str(req.get("from_unit", "")).strip()
        to_unit = str(req.get("to_unit", "")).strip()

        value = float(value_raw)
        if not from_unit or not to_unit:
            emit_event("error", message="unit_convert requires from_unit and to_unit")
            raise SystemExit(1)

        # Create quantity and convert
        quantity = value * UNIT_REGISTRY(from_unit)
        converted = quantity.to(to_unit)

        emit_event(
            "final",
            payload={"value": float(converted.magnitude), "unit": str(converted.units)},
        )
    except ValueError as e:
        emit_event("error", message=f"Invalid value or unit: {e}")
        raise SystemExit(1)
    except Exception as e:
        emit_event("error", message=f"Unit conversion failed: {e}")
        raise SystemExit(1)


def handle_handbook_qa(req: dict[str, Any]) -> None:
    """
    Answer questions about the FE handbook using mock RAG.

    In production, this would query a ChromaDB collection of embedded handbook chunks.
    For MVP, we return templated answers based on keyword matching.
    """
    question = str(req.get("question", "")).strip()

    if not question:
        emit_event("error", message="handbook_qa requires a non-empty question")
        raise SystemExit(1)

    # Mock RAG: keyword-based response templates
    question_lower = question.lower()

    # Check for formula-related questions
    if any(word in question_lower for word in ["formula", "equation", "law", "theorem"]):
        answer = (
            "The NCEES Reference Handbook provides formulas for circuits, mechanics, "
            "thermodynamics, and other FE exam topics. Use the formula search feature "
            "to find specific equations. Page numbers refer to the handbook index."
        )
        citations = ["NCEES Reference Handbook, Formula Index"]
    # Check for unit conversion questions
    elif any(word in question_lower for word in ["unit", "convert", "transformation"]):
        answer = (
            "The FE exam uses SI units by default. Common unit conversions: "
            "1 V = 1000 mV, 1 kW = 1000 W, 1 hour = 3600 s, °C to K: add 273.15. "
            "Use the unit converter tool for quick conversions."
        )
        citations = ["NCEES Reference Handbook, Units and Conversions"]
    # Check for general handbook questions
    elif any(word in question_lower for word in ["handbook", "reference", "page"]):
        answer = (
            "The NCEES Reference Handbook is provided during the FE exam. "
            "It contains formulas, reference tables, and conversion factors for all FE topics. "
            "Familiarize yourself with its organization before exam day."
        )
        citations = ["NCEES Reference Handbook, Front Matter"]
    # Default response
    else:
        answer = (
            "Your question does not match any handbook sections. "
            "Try asking about specific formulas, units, or handbook topics. "
            "For detailed explanations, consult the full NCEES Reference Handbook."
        )
        citations = ["NCEES Reference Handbook"]

    emit_event("final", payload={"answer": answer, "citations": citations})


def handle_request(req: dict[str, Any]) -> None:
    action = req.get("action")
    if action == "formula_lookup":
        handle_formula_lookup(req)
        return
    if action == "unit_convert":
        handle_unit_convert(req)
        return
    if action == "handbook_qa":
        handle_handbook_qa(req)
        return
    emit_event("error", message=f"unknown action: {action}")
    raise SystemExit(1)


def main() -> None:
    """Main entry point: read NDJSON from stdin, process, respond via stdout."""
    _load_formulas()
    _init_unit_registry()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            emit_event("error", message="invalid JSON")
            raise SystemExit(1)

        try:
            handle_request(req)
        except SystemExit:
            raise
        except Exception as e:
            emit_event("error", message=str(e))
            raise SystemExit(1) from e


if __name__ == "__main__":
    main()
