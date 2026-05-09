# FE Engine Sidecar

Reference and lookup engine for FE exam prep. Provides formula search, unit conversion, and handbook Q&A via NDJSON stdin/stdout protocol.

## Setup

```bash
cd sidecars/fe_engine
pip install -r Requirements.txt
```

## Actions

### `formula_lookup`

Search the curated NCEES formulas database by topic and/or query string.

**Input:**

```json
{
  "action": "formula_lookup",
  "topic": "circuit_analysis",
  "query": "ohm"
}
```

**Output (success):**

```json
{
  "event": "final",
  "payload": {
    "formulas": [
      {
        "id": "ohms_law",
        "name": "Ohm's Law",
        "formula_latex": "V = I \\cdot R",
        "variables": {
          "V": "Voltage (volts)",
          "I": "Current (amperes)",
          "R": "Resistance (ohms)"
        },
        "description": "Voltage equals current times resistance",
        "topic": "circuit_analysis",
        "handbook_page": 42
      }
    ]
  }
}
```

**Parameters:**

- `query` (required, string): Search term in formula name or description
- `topic` (optional, string): Filter by topic (`circuit_analysis`, `mechanics`, `thermodynamics`, `geometry`, `mathematics`)

**Topics available:** `circuit_analysis`, `mechanics`, `thermodynamics`, `geometry`, `mathematics`

---

### `unit_convert`

Convert between physical units using pint library.

**Input:**

```json
{
  "action": "unit_convert",
  "value": 120,
  "from_unit": "V",
  "to_unit": "mV"
}
```

**Output (success):**

```json
{
  "event": "final",
  "payload": {
    "value": 120000,
    "unit": "millivolt"
  }
}
```

**Parameters:**

- `value` (required, number): Value to convert
- `from_unit` (required, string): Source unit (e.g., `V`, `mV`, `m`, `cm`, `degree_C`, `degree_F`, `Kelvin`)
- `to_unit` (required, string): Target unit

**Supported units:** Any pint-recognized unit. Common examples:

- Voltage: `V`, `mV`, `kV`
- Distance: `m`, `cm`, `mm`, `km`, `in`, `ft`, `mi`
- Temperature: `degree_C`, `degree_F`, `Kelvin`
- Power: `W`, `kW`, `mW`

---

### `handbook_qa`

Answer questions about the NCEES Reference Handbook using keyword-based templates (MVP).

**Input:**

```json
{
  "action": "handbook_qa",
  "question": "How do I convert units?"
}
```

**Output (success):**

```json
{
  "event": "final",
  "payload": {
    "answer": "The FE exam uses SI units by default...",
    "citations": ["NCEES Reference Handbook, Units and Conversions"]
  }
}
```

**Parameters:**

- `question` (required, string): Question about the handbook

**Future enhancement:** Connect to ChromaDB for semantic search over embedded handbook sections.

---

## Error Handling

**Output (error):**

```json
{
  "event": "error",
  "message": "query required"
}
```

The sidecar will emit `{"event": "error", "message": "..."}` and exit with status 1 on failure.

---

## Testing

```bash
cd sidecars/fe_engine
pytest tests/
```

Test files:

- `tests/conftest.py` — pytest fixtures
- `tests/test_formula_lookup.py` — formula search tests
- `tests/test_unit_convert.py` — unit conversion tests
- `tests/test_handbook_qa.py` — handbook Q&A tests

---

## Protocol Details

- **Input:** Newline-delimited JSON (NDJSON), one action per line
- **Output:** Newline-delimited JSON (NDJSON), one response per line
- **Buffering:** All responses are flushed immediately
- **Status codes:**
  - 0: All actions succeeded
  - 1: Any action failed (error emitted before exit)

---

## Formula Database

`formulas.json` contains 50+ NCEES Reference Handbook formulas organized by topic:

- **Circuit Analysis**: Ohm's law, power, Kirchhoff's laws, impedance, etc.
- **Mechanics**: Force, work, energy, momentum, stress, strain, etc.
- **Thermodynamics**: Heat, pressure, ideal gas law, entropy, efficiency, etc.
- **Geometry**: Area, perimeter, trigonometry, etc.
- **Mathematics**: Logarithms, derivatives, integrals, etc.

Each formula includes LaTeX, variable definitions, description, topic tag, and handbook page reference.

---

## Dependencies

- `pint>=0.23` — Unit conversion engine
- `chroma-db>=0.3.21` — Vector database (future: semantic handbook search)
