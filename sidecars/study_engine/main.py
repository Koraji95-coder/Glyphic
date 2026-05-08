#!/usr/bin/env python3
"""
Glyphic Study Engine
====================

Sidecar for study-mode LLM actions. Communicates via newline-delimited JSON
on stdin/stdout. Every response is flushed immediately.

Actions:
  study_ask
    question: str
    sources: list[{"text": str, "source_label"?: str, ...}]
    endpoint: Ollama base URL (e.g. http://127.0.0.1:11434)
    model: model name

  grade_math_answer
    problem: str
    user_answer: str
    correct_answer: str
    endpoint: Ollama base URL
    model: model name

  solve_math
    problem: str        — the math/engineering problem to solve (LaTeX ok)
    endpoint: Ollama base URL
    model: model name
    Final: {"event":"final","payload":{"solution":"<step-by-step solution>"}}

  generate_problems
    topic: str          — STEM topic (e.g. "circuit analysis", "statics")
    difficulty: str     — "easy" | "medium" | "hard"  (default "medium")
    count: int          — number of problems to generate (default 5)
    endpoint: Ollama base URL
    model: model name
    Final: {"event":"final","payload":{"problems":[{"statement":"...","answer":"..."}]}}

On success:
  {"event":"final","payload":{...}}
On error:
  {"event":"error","message":"..."} and exits with status 1.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

SYSTEM_STUDY_QA = (
    "You are ScribeAI, a study assistant for STEM students preparing for professional engineering exams (FE/PE). "
    "Answer the question using the provided study material context whenever it is relevant. "
    "If the context is insufficient, say so and answer from first principles. "
    "- Always typeset math in LaTeX inside `$...$` (inline) or `$$...$$` (block). "
    "- Include units in all answers and intermediate steps. "
    "- For derivations, show step-by-step work; do not skip algebra. "
    "Format your response in markdown."
)

SYSTEM_GRADER = (
    "You are a strict but fair STEM exam grader. "
    "Given a problem, the student's submitted answer, and the reference correct answer, evaluate the student's work step by step. "
    "Respond ONLY with a JSON object — no markdown fences, no extra commentary — "
    'using this exact schema:\n{"verdict": "correct"|"partial"|"incorrect", "score": <integer 0-100>, '
    '"feedback": "<detailed explanation; use LaTeX $...$ for inline math>"}'
)

SYSTEM_MATH_SOLVER = (
    "You are an expert STEM tutor. Solve the given math or engineering problem with a clear, "
    "step-by-step solution. Requirements:\n"
    "- Show every algebraic step; do not skip steps.\n"
    "- Typeset all math in LaTeX: inline as `$...$`, block as `$$...$$`.\n"
    "- State the final answer on its own line, prefixed with **Answer:**.\n"
    "- Include SI units throughout.\n"
    "Format your response in markdown."
)

SYSTEM_PROBLEM_GENERATOR = (
    "You are an expert STEM question writer for FE/PE exam preparation. "
    "Generate practice problems for the requested topic and difficulty level. "
    "Respond ONLY with a JSON array — no markdown fences, no extra commentary — "
    "where each element matches this exact schema:\n"
    '[{"statement": "<problem text; use LaTeX $...$ for inline math>", '
    '"answer": "<concise final answer with units>"}]'
)

ALLOWED_DIFFICULTIES = {"easy", "medium", "hard"}


def respond(obj: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def emit_event(event: str, **payload: Any) -> None:
    respond({"event": event, **payload})


def _strip_json_object(text: str) -> str:
    trimmed = text.strip()
    if "```json" in trimmed:
        after = trimmed.split("```json", 1)[1]
        content = after.split("```", 1)[0]
    elif "```" in trimmed:
        after = trimmed.split("```", 1)[1]
        content = after.split("```", 1)[0]
    else:
        content = trimmed
    content = content.strip()

    start = content.find("{")
    end = content.rfind("}")
    if start >= 0 and end >= 0 and end >= start:
        return content[start : end + 1]
    return content


def _strip_json_array(text: str) -> str:
    """Extract the outermost JSON array from text, stripping markdown fences."""
    trimmed = text.strip()
    if "```json" in trimmed:
        after = trimmed.split("```json", 1)[1]
        content = after.split("```", 1)[0]
    elif "```" in trimmed:
        after = trimmed.split("```", 1)[1]
        content = after.split("```", 1)[0]
    else:
        content = trimmed
    content = content.strip()

    start = content.find("[")
    end = content.rfind("]")
    if start >= 0 and end >= 0 and end >= start:
        return content[start : end + 1]
    return content


def _ollama_chat(endpoint: str, model: str, system_prompt: str, user_content: str) -> str:
    parsed = urllib.parse.urlparse(endpoint)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeError("endpoint must be a valid http(s) URL")

    url = endpoint.rstrip("/") + "/api/chat"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "stream": False,
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})

    try:
        # noqa: S310 is intentional here; endpoint comes from trusted local app config.
        with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as e:
        raise RuntimeError(f"Ollama request failed: {e}") from e
    except TimeoutError as e:
        raise RuntimeError(f"Ollama request timed out: {e}") from e
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid Ollama JSON response: {e}") from e

    content = data.get("message", {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Ollama returned an empty message content")
    return content


def _build_context(sources: list[dict[str, Any]]) -> str:
    rows: list[str] = []
    for src in sources:
        text = src.get("text")
        if not isinstance(text, str) or not text.strip():
            continue
        label = src.get("source_label")
        if not isinstance(label, str) or not label.strip():
            label = "source"
        rows.append(f"[{label}]: {text}")
    return "\n\n".join(rows)


def handle_study_ask(req: dict[str, Any]) -> None:
    question = str(req.get("question", "")).strip()
    endpoint = str(req.get("endpoint", "")).strip()
    model = str(req.get("model", "")).strip()
    raw_sources = req.get("sources", [])
    sources = raw_sources if isinstance(raw_sources, list) else []

    if not question:
        emit_event("error", message="study_ask requires a non-empty question")
        raise SystemExit(1)
    if not endpoint:
        emit_event("error", message="study_ask requires endpoint")
        raise SystemExit(1)
    if not model:
        emit_event("error", message="study_ask requires model")
        raise SystemExit(1)

    context = _build_context(sources)
    system_prompt = SYSTEM_STUDY_QA
    if context:
        system_prompt += "\n\n## Relevant Study Material\n\n" + context

    answer = _ollama_chat(endpoint, model, system_prompt, question)
    emit_event("final", payload={"answer": answer})


def handle_grade_math_answer(req: dict[str, Any]) -> None:
    problem = str(req.get("problem", "")).strip()
    user_answer = str(req.get("user_answer", "")).strip()
    correct_answer = str(req.get("correct_answer", "")).strip()
    endpoint = str(req.get("endpoint", "")).strip()
    model = str(req.get("model", "")).strip()

    if not problem or not user_answer or not correct_answer:
        emit_event(
            "error",
            message="grade_math_answer requires non-empty problem, user_answer, and correct_answer",
        )
        raise SystemExit(1)
    if not endpoint:
        emit_event("error", message="grade_math_answer requires endpoint")
        raise SystemExit(1)
    if not model:
        emit_event("error", message="grade_math_answer requires model")
        raise SystemExit(1)

    user_content = (
        f"Problem:\n{problem}\n\nStudent's Answer:\n{user_answer}\n\nCorrect Answer:\n{correct_answer}"
    )
    raw = _ollama_chat(endpoint, model, SYSTEM_GRADER, user_content)
    stripped = _strip_json_object(raw)

    try:
        parsed = json.loads(stripped)
        if not isinstance(parsed, dict):
            raise ValueError("grader response is not a JSON object")
    except Exception:
        parsed = {
            "verdict": "unknown",
            "score": 0,
            "feedback": stripped,
        }

    emit_event("final", payload=parsed)


def handle_solve_math(req: dict[str, Any]) -> None:
    problem = str(req.get("problem", "")).strip()
    endpoint = str(req.get("endpoint", "")).strip()
    model = str(req.get("model", "")).strip()

    if not problem:
        emit_event("error", message="solve_math requires a non-empty problem")
        raise SystemExit(1)
    if not endpoint:
        emit_event("error", message="solve_math requires endpoint")
        raise SystemExit(1)
    if not model:
        emit_event("error", message="solve_math requires model")
        raise SystemExit(1)

    solution = _ollama_chat(endpoint, model, SYSTEM_MATH_SOLVER, problem)
    emit_event("final", payload={"solution": solution})


def handle_generate_problems(req: dict[str, Any]) -> None:
    topic = str(req.get("topic", "")).strip()
    difficulty = str(req.get("difficulty", "medium")).strip().lower()
    count_raw = req.get("count", 5)
    endpoint = str(req.get("endpoint", "")).strip()
    model = str(req.get("model", "")).strip()

    if not topic:
        emit_event("error", message="generate_problems requires a non-empty topic")
        raise SystemExit(1)
    if difficulty not in ALLOWED_DIFFICULTIES:
        emit_event(
            "error",
            message="generate_problems difficulty must be 'easy', 'medium', or 'hard'",
        )
        raise SystemExit(1)
    if not endpoint:
        emit_event("error", message="generate_problems requires endpoint")
        raise SystemExit(1)
    if not model:
        emit_event("error", message="generate_problems requires model")
        raise SystemExit(1)

    try:
        count = int(count_raw)
        if count < 1 or count > 20:
            raise ValueError
    except (TypeError, ValueError):
        emit_event("error", message="generate_problems count must be an integer between 1 and 20")
        raise SystemExit(1)

    user_content = (
        f"Topic: {topic}\nDifficulty: {difficulty}\nNumber of problems: {count}\n\n"
        "Generate the requested practice problems now."
    )
    raw = _ollama_chat(endpoint, model, SYSTEM_PROBLEM_GENERATOR, user_content)

    # Generator returns an array [ … ] rather than an object { … }
    stripped_arr = _strip_json_array(raw)

    try:
        problems = json.loads(stripped_arr)
        if not isinstance(problems, list):
            raise ValueError("expected a JSON array")
        # Normalize each problem entry
        normalized = []
        for item in problems:
            if isinstance(item, dict):
                normalized.append(
                    {
                        "statement": str(item.get("statement", "")).strip(),
                        "answer": str(item.get("answer", "")).strip(),
                    }
                )
    except Exception:
        # Fall back: wrap raw text so the caller always receives a typed object
        normalized = [{"statement": raw.strip(), "answer": ""}]

    emit_event("final", payload={"problems": normalized})


def handle_request(req: dict[str, Any]) -> None:
    action = req.get("action")
    if action == "study_ask":
        handle_study_ask(req)
        return
    if action == "grade_math_answer":
        handle_grade_math_answer(req)
        return
    if action == "solve_math":
        handle_solve_math(req)
        return
    if action == "generate_problems":
        handle_generate_problems(req)
        return
    emit_event("error", message=f"unknown action: {action}")
    raise SystemExit(1)


def main() -> None:
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
