#!/usr/bin/env python3
"""
Glyphic Diagram Engine
======================

Sidecar for generating diagrams. Communicates via newline-delimited JSON
on stdin/stdout. Every response is flushed immediately.

Supported diagram types:
  schemdraw / circuit   — circuit diagrams via schemdraw + matplotlib
  matplotlib / phasor / polar — polar/phasor plots via matplotlib
  mermaid               — returned as-is for frontend rendering via Mermaid JS

Actions:
  render
    diagram_type: one of the types above
    code: Python code string (schemdraw/matplotlib) or Mermaid syntax string

  generate_code
    description: natural-language request for the desired diagram
    diagram_type: "mermaid" | "schemdraw" | "matplotlib" | "auto" (default: "auto")
    Emits NDJSON events:
      {"event":"progress","stage":"prompting"}
      {"event":"progress","stage":"generating"}
      {"event":"progress","stage":"validating"}
      {"event":"final","code":"...","language":"mermaid|python",
       "diagram_type":"mermaid|schemdraw|matplotlib","warnings":[]}
    On error:
      {"event":"error","message":"..."} and exits with status 1.

Responses:
  {"svg_base64": "..."}  — for schemdraw and matplotlib types
  {"mermaid": "..."}     — for mermaid type
  {"error": "..."}       — on failure
"""

import base64
import concurrent.futures
import io
import json
import os
import re
import sys
import traceback
import urllib.error
import urllib.request
import urllib.parse
from typing import Any

# ── Security blocklist ────────────────────────────────────────────────────────
# Defence-in-depth: reject code that contains known dangerous patterns before
# passing it to exec().  This is NOT a complete sandbox — a proper solution
# would use RestrictedPython or a subprocess with OS-level resource limits
# (e.g. seccomp, nsjail, or Docker).  This blocklist stops accidental or
# naive misuse and makes the attack surface explicit.
_BLOCKED_PATTERNS = [
    "import os",
    "import subprocess",
    "import sys",
    "import socket",
    "import shutil",
    "import pathlib",
    "import tempfile",
    "import threading",
    "import multiprocessing",
    "import ctypes",
    "import importlib",
    "__import__",
    "__builtins__",
    "open(",
    "exec(",
    "eval(",
    "compile(",
    "globals(",
    "locals(",
    "getattr(",
    "setattr(",
    "delattr(",
    "vars(",
]

MAX_GENERATION_ATTEMPTS = 2


def _check_code_safety(code: str) -> str | None:
    """Return an error message if the code contains a blocked pattern, else None."""
    lower = code.lower()
    for pattern in _BLOCKED_PATTERNS:
        if pattern.lower() in lower:
            return (
                f"Code contains a blocked pattern: '{pattern}'. "
                "Only matplotlib, schemdraw, and numpy imports are permitted."
            )
    return None


def respond(obj: dict[str, Any]) -> None:
    """Write one JSON object to stdout and flush immediately."""
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def emit_event(event: str, **payload: Any) -> None:
    respond({"event": event, **payload})


def _canonical_generate_diagram_type(diagram_type: str) -> str:
    normalized = (diagram_type or "auto").strip().lower()
    if normalized in {"", "auto"}:
        return "auto"
    if normalized in {"schemdraw", "circuit"}:
        return "schemdraw"
    if normalized in {"matplotlib", "phasor", "polar"}:
        return "matplotlib"
    if normalized == "mermaid":
        return "mermaid"
    raise ValueError(
        f"unsupported diagram_type: {diagram_type!r}. Supported: auto, mermaid, schemdraw, matplotlib"
    )


def _build_generate_prompt(description: str, diagram_type: str, feedback: str | None = None) -> str:
    if diagram_type == "mermaid":
        type_hint = "Return only valid Mermaid diagram syntax, no other text."
    elif diagram_type in {"schemdraw", "matplotlib"}:
        type_hint = (
            "Return only valid Python code. For schemdraw: assign the schemdraw.Drawing() "
            "to a variable named 'd'. For matplotlib plots: use plt (already available) to create "
            "the figure. No plt.show(). No other text or explanation."
        )
    else:
        type_hint = (
            "Choose the best diagram format for the request and output JSON only with keys "
            '{"diagram_type","language","code"} where diagram_type is one of '
            '["mermaid","schemdraw","matplotlib"] and language is "mermaid" or "python". '
            "Use Mermaid for flowcharts/sequence/state diagrams, Schemdraw for circuit diagrams, "
            "and Matplotlib for plots/phasors."
        )

    prompt = (
        "You are Glyphic's diagram code generator.\n"
        f"User request: {description}\n"
        f"Requested diagram_type: {diagram_type}\n"
        f"{type_hint}"
    )
    if feedback:
        prompt += f"\nPrevious output failed validation with: {feedback}\nReturn corrected output only."
    return prompt


def _ollama_generate(prompt: str) -> str:
    url = os.environ.get("GLYPHIC_OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeError("GLYPHIC_OLLAMA_URL must be a valid http(s) URL")
    model = os.environ.get("GLYPHIC_DIAGRAM_MODEL", "llama3.1:8b")
    payload = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as e:
        raise RuntimeError(f"Ollama request failed: {e}") from e
    except TimeoutError as e:
        raise RuntimeError(f"Ollama request timed out: {e}") from e
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid Ollama JSON response: {e}") from e

    response = data.get("response")
    if not isinstance(response, str) or not response.strip():
        raise RuntimeError("Ollama returned an empty response")
    return response.strip()


def _strip_fences(text: str) -> tuple[str, bool]:
    stripped = text.strip()
    changed = False
    fence_match = re.fullmatch(r"```[a-zA-Z0-9_-]*\n?(.*?)\n?```", stripped, flags=re.DOTALL)
    if fence_match:
        stripped = fence_match.group(1).strip()
        changed = True
    return stripped, changed


def _normalize_generated_payload(raw: str, requested_type: str) -> tuple[str, str, str, list[str]]:
    warnings: list[str] = []
    code_text = raw.strip()
    diagram_type = requested_type
    language = "python"

    try:
        obj = json.loads(code_text)
        if isinstance(obj, dict) and isinstance(obj.get("code"), str):
            code_text = obj["code"].strip()
            if isinstance(obj.get("diagram_type"), str):
                diagram_type = _canonical_generate_diagram_type(obj["diagram_type"])
            if isinstance(obj.get("language"), str):
                language = obj["language"].strip().lower()
        else:
            code_text = raw.strip()
    except json.JSONDecodeError:
        pass

    code_text, stripped_fence = _strip_fences(code_text)
    if stripped_fence:
        warnings.append("stripped markdown code fences from LLM output")

    if requested_type == "auto":
        lowered = code_text.lower()
        if diagram_type == "auto":
            if any(
                keyword in lowered
                for keyword in (
                    "flowchart",
                    "graph ",
                    "sequencediagram",
                    "statediagram",
                    "erdiagram",
                    "classdiagram",
                )
            ):
                diagram_type = "mermaid"
            elif "schemdraw" in lowered or "elm." in lowered:
                diagram_type = "schemdraw"
            else:
                diagram_type = "matplotlib"

    if diagram_type == "auto":
        diagram_type = "matplotlib"

    if diagram_type == "mermaid":
        language = "mermaid"
    else:
        language = "python"
    return code_text, language, diagram_type, warnings


def _validate_generated_code(code: str, diagram_type: str) -> None:
    if not code.strip():
        raise ValueError("generated code is empty")
    if diagram_type == "mermaid":
        lowered = code.lower()
        known_keywords = (
            "flowchart",
            "graph ",
            "sequencediagram",
            "statediagram",
            "classdiagram",
            "erdiagram",
            "journey",
            "gantt",
            "pie",
            "mindmap",
            "timeline",
            "gitgraph",
            "quadrantchart",
            "requirementdiagram",
            "block-beta",
        )
        if not any(keyword in lowered for keyword in known_keywords):
            raise ValueError("mermaid validation failed: no known diagram keyword found")
        return
    compile(code, "", "exec")


def handle_generate_code(req: dict[str, Any]) -> None:
    description = str(req.get("description", "")).strip()
    if not description:
        emit_event("error", message="description is required")
        raise SystemExit(1)

    try:
        requested_type = _canonical_generate_diagram_type(str(req.get("diagram_type", "auto")))
    except ValueError as e:
        emit_event("error", message=str(e))
        raise SystemExit(1) from e

    warnings: list[str] = []
    validation_error: str | None = None

    for attempt in range(MAX_GENERATION_ATTEMPTS):
        emit_event("progress", stage="prompting")
        prompt = _build_generate_prompt(description, requested_type, validation_error)
        emit_event("progress", stage="generating")

        try:
            raw_output = _ollama_generate(prompt)
            code, language, diagram_type, parse_warnings = _normalize_generated_payload(
                raw_output, requested_type
            )
            warnings.extend(parse_warnings)
            emit_event("progress", stage="validating")
            _validate_generated_code(code, diagram_type)
            emit_event(
                "final",
                code=code,
                language=language,
                diagram_type=diagram_type,
                warnings=warnings,
            )
            return
        except SystemExit:
            raise
        except Exception as e:
            validation_error = str(e)
            if attempt < MAX_GENERATION_ATTEMPTS - 1:
                warnings.append(f"first attempt failed validation or generation: {validation_error}")
                continue
            emit_event("error", message=validation_error)
            raise SystemExit(1) from e


# ── Schemdraw ─────────────────────────────────────────────────────────────────
def _exec_schemdraw(code: str) -> dict[str, Any]:
    """
    Execute schemdraw Python code and return the drawing as SVG.

    The user code must assign the schemdraw.Drawing() instance to a
    variable named `d`. Example:

        import schemdraw.elements as elm
        d = schemdraw.Drawing()
        d += elm.Resistor().right().label('R1')
        d += elm.Capacitor().down()
        d += elm.Line().left()
        d += elm.SourceV().up().label('V1')

    schemdraw 0.16 uses a matplotlib backend. To get SVG output we save
    the figure to a BytesIO buffer after the drawing has been rendered.
    draw_svg() does NOT exist in 0.16 — use matplotlib.savefig() instead.
    """
    safety_err = _check_code_safety(code)
    if safety_err:
        return {"error": safety_err}

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import schemdraw
        import schemdraw.elements as elm  # type: ignore

        local_vars: dict[str, Any] = {
            "schemdraw": schemdraw,
            "elm": elm,
            "plt": plt,
        }

        exec(code, {}, local_vars)  # noqa: S102

        # The user code must assign their Drawing to `d`
        drawing = local_vars.get("d")
        if drawing is None:
            return {"error": "User code must assign the schemdraw.Drawing() to a variable named 'd'"}

        # Draw the diagram — this renders into the current matplotlib figure
        drawing.draw()

        buf = io.BytesIO()
        plt.savefig(buf, format="svg", bbox_inches="tight")
        plt.close("all")
        buf.seek(0)
        svg_b64 = base64.b64encode(buf.read()).decode("utf-8")
        return {"svg_base64": svg_b64}

    except Exception as e:
        plt.close("all")  # always clean up
        return {"error": f"schemdraw execution failed: {e}\n{traceback.format_exc()}"}


def render_schemdraw(code: str) -> dict[str, Any]:
    """Run schemdraw code with a 10-second timeout."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_exec_schemdraw, code)
        try:
            return future.result(timeout=10)
        except concurrent.futures.TimeoutError:
            return {"error": "schemdraw execution timed out (10s limit)"}
        except Exception as e:
            return {"error": f"schemdraw executor error: {e}"}


# ── Matplotlib (phasor, polar, general) ───────────────────────────────────────
def _exec_matplotlib(code: str) -> dict[str, Any]:
    """
    Execute matplotlib Python code and return the figure as SVG.

    The user code should use plt.figure() or plt.subplot(projection='polar')
    to create the figure, then add its content. Do NOT call plt.show().
    Example (phasor diagram):

        import numpy as np
        fig, ax = plt.subplots(subplot_kw={'projection': 'polar'})
        ax.annotate('', xy=(0.5, np.pi/4), xytext=(0, 0),
                    arrowprops=dict(arrowstyle='->', color='blue', lw=2))
        ax.set_title('Phasor V')
    """
    safety_err = _check_code_safety(code)
    if safety_err:
        return {"error": safety_err}

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np  # type: ignore

        local_vars: dict[str, Any] = {"plt": plt, "np": np}
        exec(code, {}, local_vars)  # noqa: S102

        fig = plt.gcf()
        buf = io.BytesIO()
        fig.savefig(buf, format="svg", bbox_inches="tight")
        plt.close("all")
        buf.seek(0)
        svg_b64 = base64.b64encode(buf.read()).decode("utf-8")
        return {"svg_base64": svg_b64}

    except Exception as e:
        try:
            import matplotlib.pyplot as plt
            plt.close("all")
        except Exception:
            pass
        return {"error": f"matplotlib execution failed: {e}\n{traceback.format_exc()}"}


def render_matplotlib(code: str) -> dict[str, Any]:
    """Run matplotlib code with a 10-second timeout."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_exec_matplotlib, code)
        try:
            return future.result(timeout=10)
        except concurrent.futures.TimeoutError:
            return {"error": "matplotlib execution timed out (10s limit)"}
        except Exception as e:
            return {"error": f"matplotlib executor error: {e}"}


# ── Request handler ───────────────────────────────────────────────────────────
def handle_request(req: dict[str, Any]) -> None:
    action = req.get("action")
    if action == "generate_code":
        handle_generate_code(req)
        return

    if action != "render":
        respond({"error": f"unknown action: {action!r} — supported: 'render', 'generate_code'"})
        return

    diagram_type = req.get("diagram_type", "").strip()
    code = req.get("code", "")

    if not diagram_type:
        respond({"error": "diagram_type is required"})
        return

    if diagram_type in {"schemdraw", "circuit"}:
        respond(render_schemdraw(code))

    elif diagram_type in {"matplotlib", "phasor", "polar"}:
        respond(render_matplotlib(code))

    elif diagram_type == "mermaid":
        # Mermaid is rendered entirely in the frontend via Mermaid JS.
        # The sidecar simply echoes the syntax back.
        respond({"mermaid": code})

    else:
        respond({"error": f"unknown diagram_type: {diagram_type!r}. "
                          "Supported: schemdraw, circuit, matplotlib, phasor, polar, mermaid"})


# ── Main loop ─────────────────────────────────────────────────────────────────
def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            respond({"error": "invalid JSON — each request must be a single JSON object"})
            continue
        try:
            handle_request(req)
        except SystemExit:
            raise
        except Exception as e:
            emit_event("error", message=f"unexpected diagram engine failure: {e}")
            raise SystemExit(1) from e


if __name__ == "__main__":
    main()
