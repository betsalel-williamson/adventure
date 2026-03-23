#!/usr/bin/env python3
"""
JSONL stdio worker for MLX Gemma (Apple Silicon). Loads the model once, then:

  - First stdout line: {"type": "ready"}
  - Each stdin line: {"id": "<string>", "prompt": "<text>", "max_tokens": <int optional>}
  - Each response line: {"id": "<same>", "text": "<model output>", "error": null | "<msg>"}

Install deps: from adventure-llm directory run ``uv venv`` then ``uv sync`` (uses ``pyproject.toml``).

Default model (override with ADVENTURE_LLM_MLX_MODEL): mlx-community/gemma-2-2b-it
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


def main() -> None:
    model_id = os.environ.get(
        "ADVENTURE_LLM_MLX_MODEL", "mlx-community/gemma-2-2b-it"
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
        full_prompt = _gemma2_turns(prompt)

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
