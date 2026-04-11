#!/usr/bin/env python3
"""
JSONL stdio worker for MLX (Apple Silicon). Loads the model once, then:

  - After ``load()`` completes, one stdout line: {"type": "ready"} (libraries may print non-JSON
    lines to stdout before that; the Node client skips non-JSON lines until ``ready``).
  - Each stdin line: {"id": "<string>", "prompt": "<text>", "system": "<optional; merged before prompt when non-empty>", "max_tokens": <int optional>, "temp": <float optional>, "stop": [<str>, ...] optional}
  - Each response line: {"id": "<same>", "text": "<model output>", "error": null | "<msg>"}

Install deps: from adventure-nl directory run ``uv venv`` then ``uv sync`` (uses ``pyproject.toml``).

Gemma IT models only define **user** and **model** turns; there is no separate **system** role.
Autoplay may send **system** (rules + JSON schema) and **prompt** (engine state, candidates,
transcript). If ``system`` is non-empty, it is prepended to ``prompt`` for generation. See
Google’s Gemma prompt notes: https://ai.google.dev/gemma/docs/core/prompt-structure

Prompts use the tokenizer's ``apply_chat_template`` when available; otherwise Gemma-2-style
turns as above.

Default model (override with ADVENTURE_NL_MLX_MODEL): mlx-community/gemma-2-2b-it
"""
from __future__ import annotations

import json
import os
import sys


def _gemma2_turns(user_text: str) -> str:
    """Official Gemma IT single-turn pattern: one user block (may include 'system' instructions inside it), then model prefix."""
    return (
        "<start_of_turn>user\n"
        f"{user_text}\n"
        "<end_of_turn>\n"
        "<start_of_turn>model\n"
    )


def _default_mlx_temp() -> float:
    v = os.environ.get("ADVENTURE_NL_MLX_TEMP", "0.75").strip()
    try:
        t = float(v)
        return max(0.0, min(2.0, t))
    except ValueError:
        return 0.75


def _default_stop_strings() -> list[str]:
    raw = os.environ.get("ADVENTURE_NL_MLX_STOP", "").strip()
    if not raw:
        return []
    return [s.strip() for s in raw.split(",") if s.strip()]


def _truncate_at_stop_strings(text: str, stops: list[str]) -> str:
    """Cut model output before the first occurrence of any stop substring (Gemma anti-hallucination)."""
    if not text or not stops:
        return text
    best = len(text)
    for s in stops:
        i = text.find(s)
        if i >= 0:
            best = min(best, i)
    return text[:best] if best < len(text) else text


def _build_generation_prompt(tokenizer: object, user_text: str, model_id: str) -> str:
    """Use HF chat template when present; else Gemma-2 turns; else raw text."""
    chat_template = getattr(tokenizer, "chat_template", None)
    apply_fn = getattr(tokenizer, "apply_chat_template", None)
    if chat_template and callable(apply_fn):
        try:
            messages = [{"role": "user", "content": user_text}]
            out = apply_fn(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )
            if isinstance(out, str) and out.strip():
                return out
        except Exception:
            pass
    if "gemma" in model_id.lower():
        return _gemma2_turns(user_text)
    return user_text


def main() -> None:
    model_id = os.environ.get(
        "ADVENTURE_NL_MLX_MODEL", "mlx-community/gemma-2-2b-it"
    ).strip()

    try:
        from mlx_lm import generate, load  # type: ignore[import-untyped]
        from mlx_lm.sample_utils import make_sampler  # type: ignore[import-untyped]
    except ImportError as e:
        print(
            json.dumps(
                {
                    "type": "error",
                    "message": "mlx_lm not installed. Run: pip install mlx-lm",
                }
            ),
            flush=True,
        )
        print(f"MLX import error: {e}", file=sys.stderr, flush=True)
        sys.exit(1)

    print(f"adventure-nl mlx: loading {model_id}…", file=sys.stderr, flush=True)
    model, tokenizer = load(model_id)
    print("adventure-nl mlx: model loaded.", file=sys.stderr, flush=True)

    print(json.dumps({"type": "ready"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            print(
                json.dumps(
                    {
                        "id": "",
                        "text": "",
                        "error": f"invalid JSON on stdin: {e}",
                    }
                ),
                flush=True,
            )
            continue

        rid = str(req.get("id", ""))
        system_raw = req.get("system")
        prompt_raw = req.get("prompt")
        system = system_raw.strip() if isinstance(system_raw, str) else ""
        prompt = prompt_raw.strip() if isinstance(prompt_raw, str) else ""
        if system:
            user_text = f"{system}\n\n{prompt}" if prompt else system
        elif prompt:
            user_text = prompt
        else:
            print(
                json.dumps(
                    {
                        "id": rid,
                        "text": "",
                        "error": "missing or invalid prompt (need prompt and/or system)",
                    }
                ),
                flush=True,
            )
            continue

        max_tokens = int(req.get("max_tokens", 512))
        full_prompt = _build_generation_prompt(tokenizer, user_text, model_id)

        temp = _default_mlx_temp()
        if "temp" in req and req["temp"] is not None:
            try:
                temp = float(req["temp"])
                temp = max(0.0, min(2.0, temp))
            except (TypeError, ValueError):
                pass

        stop_strings = _default_stop_strings()
        if isinstance(req.get("stop"), list):
            stop_strings = [str(x).strip() for x in req["stop"] if str(x).strip()]
        sampler = make_sampler(temp)

        try:
            raw = generate(
                model,
                tokenizer,
                prompt=full_prompt,
                max_tokens=max_tokens,
                verbose=False,
                sampler=sampler,
            )
            if isinstance(raw, str):
                text = raw
            elif hasattr(raw, "__iter__") and not isinstance(raw, (bytes, dict)):
                text = "".join(str(x) for x in raw)
            else:
                text = str(raw)
            text = _truncate_at_stop_strings(text, stop_strings)
            print(
                json.dumps({"id": rid, "text": text, "error": None}),
                flush=True,
            )
        except Exception as e:
            print(
                json.dumps({"id": rid, "text": "", "error": str(e)}),
                flush=True,
            )


if __name__ == "__main__":
    main()
