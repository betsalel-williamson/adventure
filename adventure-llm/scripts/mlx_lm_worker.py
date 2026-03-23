#!/usr/bin/env python3
"""
JSONL stdio worker for MLX (Apple Silicon). Loads the model once, then:

  - First stdout line: {"type": "ready"}
  - Each stdin line: {"id": "<string>", "prompt": "<text>", "max_tokens": <int optional>}
  - Each response line: {"id": "<same>", "text": "<model output>", "error": null | "<msg>"}

Install deps: from adventure-llm directory run ``uv venv`` then ``uv sync`` (uses ``pyproject.toml``).

Prompts use the tokenizer's ``apply_chat_template`` when available; otherwise a Gemma-2-style
wrap for legacy compatibility.

Default model (override with ADVENTURE_LLM_MLX_MODEL): mlx-community/gemma-2-9b-it-4bit
"""
from __future__ import annotations

import json
import os
import sys


def _gemma2_turns(user_text: str) -> str:
    """Gemma 2 chat template (instruction-tuned): user turn then model turn prefix."""
    return (
        "<start_of_turn>user\n"
        f"{user_text}\n"
        "<end_of_turn>\n"
        "<start_of_turn>model\n"
    )


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
        "ADVENTURE_LLM_MLX_MODEL", "mlx-community/gemma-2-9b-it-4bit"
    ).strip()

    try:
        from mlx_lm import generate, load  # type: ignore[import-untyped]
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

    print(f"adventure-llm mlx: loading {model_id}…", file=sys.stderr, flush=True)
    model, tokenizer = load(model_id)
    print("adventure-llm mlx: model loaded.", file=sys.stderr, flush=True)

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
        prompt = req.get("prompt")
        if not isinstance(prompt, str) or not prompt:
            print(
                json.dumps(
                    {
                        "id": rid,
                        "text": "",
                        "error": "missing or invalid prompt",
                    }
                ),
                flush=True,
            )
            continue

        max_tokens = int(req.get("max_tokens", 512))
        full_prompt = _build_generation_prompt(tokenizer, prompt, model_id)

        try:
            raw = generate(
                model,
                tokenizer,
                prompt=full_prompt,
                max_tokens=max_tokens,
                verbose=False,
            )
            if isinstance(raw, str):
                text = raw
            elif hasattr(raw, "__iter__") and not isinstance(raw, (bytes, dict)):
                text = "".join(str(x) for x in raw)
            else:
                text = str(raw)
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
