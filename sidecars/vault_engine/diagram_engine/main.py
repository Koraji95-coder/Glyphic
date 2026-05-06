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

Each request must have:
  action: "render"
  diagram_type: one of the types above
  code: Python code string (schemdraw/matplotlib) or Mermaid syntax string

Responses:
  {"svg_base64": "..."}  — for schemdraw and matplotlib types
  {"mermaid": "..."}     — for mermaid type
  {"error": "..."}       — on failure
"""

import base64
import concurrent.futures
import io
import json
import sys
import traceback
from typing import Any


def respond(obj: dict[str, Any]) -> None:
    """Write one JSON object to stdout and flush immediately."""
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


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
    if action != "render":
        respond({"error": f"unknown action: {action!r} — only 'render' is supported"})
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
        handle_request(req)


if __name__ == "__main__":
    main()
