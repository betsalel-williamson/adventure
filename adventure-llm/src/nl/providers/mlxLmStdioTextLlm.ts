import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AutoplayPlannerResponseSchema,
  InterpretedCommandSchema,
  type AutoplayPlannerResponse,
  type InterpretedCommand,
} from "../schema.js";
import type { AdventureDatabase } from "../../dat/types.js";
import {
  appendInteractionLog,
  resolveCacheDir,
  writeCachedInterpreted,
} from "../llmDebug.js";
import { interpretCacheKeyFromBuildOptions } from "../interpretCacheKey.js";
import { loadCachedInterpretIfHit } from "../interpretDiskCache.js";
import {
  finalizeAutoplayPlannerResponse,
  finalizeInterpretedCommand,
} from "../textLlmInterpretPipeline.js";
import {
  buildAutoplayPlannerPrompt,
  buildAutoplayPlannerPromptParts,
  buildInterpretSystemAndUserPrompt,
  resolveCompactPrompts,
  resolveStructuredDashboardPrompts,
} from "../adventureNlPrompts.js";
import {
  buildAutoplayRelevantTokensFilterPrompt,
  buildSituationalCandidateTokens,
  parseRelevantTokensResponse,
} from "../situationalCandidates.js";
import { parseJsonObjectFromLlmText } from "../jsonFromLlmText.js";
import {
  coerceAutoplayPlannerJson,
  coerceInterpretedCommandJson,
} from "../coerceLlmJson.js";
import type {
  InterpretPlayerInputOptions,
  PlannerUserPromptInput,
  TextLlm,
} from "../textLlmContract.js";

export type MlxLmStdioTextLlmOptions = {
  /** Hugging Face repo id, e.g. mlx-community/gemma-2-2b-it */
  modelId: string;
  /**
   * When true (default), runs `uv run python <script>` with `cwd` at the package root (see `pyproject.toml`).
   * Set `ADVENTURE_LLM_MLX_USE_UV=0` to use `pythonPath` + script directly.
   */
  useUv?: boolean;
  /** `uv` executable (default `uv`). */
  uvPath?: string;
  /** Directory containing `pyproject.toml` (default: parent of `scripts/`). */
  packageRoot?: string;
  /** Python interpreter when `useUv` is false (default python3). */
  pythonPath?: string;
  /** Path to mlx_lm_worker.py (default: package scripts/) */
  scriptPath?: string;
  maxTokens?: number;
  /** Max wait for first model load (ms). */
  readyTimeoutMs?: number;
  /**
   * Shorter prompts + smaller vocab list for small local models.
   * Default: {@link resolveCompactPrompts} for `mlx` (typically true unless `ADVENTURE_LLM_COMPACT_PROMPTS=0`).
   */
  compactPrompts?: boolean;
};

function resolveMlxGenTemp(): number {
  const v = process.env.ADVENTURE_LLM_MLX_TEMP?.trim();
  if (v === undefined || v === "") return 0.75;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 2 ? n : 0.75;
}

function resolveMlxStopStrings(): string[] {
  const v = process.env.ADVENTURE_LLM_MLX_STOP?.trim();
  if (v === undefined || v === "") return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function defaultWorkerScriptPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../scripts/mlx_lm_worker.py");
}

/**
 * Apple Silicon MLX via a persistent Python stdio worker (`scripts/mlx_lm_worker.py`).
 * Model loads on first use; keep one subprocess for the session.
 */
export class MlxLmStdioTextLlm implements TextLlm {
  readonly providerId = "mlx" as const;
  readonly modelId: string;

  private readonly useUv: boolean;
  private readonly uvPath: string;
  private readonly packageRoot: string;
  private readonly pythonPath: string;
  private readonly resolvedScriptPath: string;
  private readonly maxTokens: number;
  private readonly readyTimeoutMs: number;
  private readonly compactPrompts: boolean;
  private readonly mlxGenTemp: number;
  private readonly mlxStopStrings: string[];

  private child: ChildProcessWithoutNullStreams | null = null;
  private rl: ReturnType<typeof createInterface> | null = null;
  private readyPromise: Promise<void> | null = null;
  private pending = new Map<
    string,
    { resolve: (v: string) => void; reject: (e: Error) => void }
  >();
  private requestId = 0;
  private mutex: Promise<void> = Promise.resolve();

  constructor(options: MlxLmStdioTextLlmOptions) {
    this.modelId = options.modelId.trim();
    this.useUv = options.useUv !== false;
    this.uvPath = options.uvPath?.trim() || "uv";
    const scriptPath = options.scriptPath?.trim() || defaultWorkerScriptPath();
    this.resolvedScriptPath = path.resolve(scriptPath);
    this.packageRoot =
      options.packageRoot !== undefined && options.packageRoot.trim() !== ""
        ? path.resolve(options.packageRoot.trim())
        : path.resolve(path.dirname(this.resolvedScriptPath), "..");
    this.pythonPath = options.pythonPath?.trim() || "python3";
    this.maxTokens = options.maxTokens ?? 512;
    this.readyTimeoutMs = options.readyTimeoutMs ?? 900_000;
    this.compactPrompts =
      options.compactPrompts ?? resolveCompactPrompts("mlx");
    this.mlxGenTemp = resolveMlxGenTemp();
    this.mlxStopStrings = resolveMlxStopStrings();
  }

  private async withMutex<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.mutex;
    let release!: () => void;
    this.mutex = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private async ensureWorker(): Promise<void> {
    if (this.readyPromise) {
      await this.readyPromise;
      return;
    }

    if (!existsSync(this.resolvedScriptPath)) {
      throw new Error(
        `MLX worker script not found: ${this.resolvedScriptPath}. Install scripts/mlx_lm_worker.py or set ADVENTURE_LLM_MLX_SCRIPT.`,
      );
    }

    if (this.useUv) {
      const pyproject = path.join(this.packageRoot, "pyproject.toml");
      if (!existsSync(pyproject)) {
        throw new Error(
          `MLX (uv): missing ${pyproject}. From adventure-llm run: uv venv && uv sync`,
        );
      }
    }

    this.readyPromise = new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        ADVENTURE_LLM_MLX_MODEL: this.modelId,
      };

      const child = this.useUv
        ? spawn(this.uvPath, ["run", "python", this.resolvedScriptPath], {
            cwd: this.packageRoot,
            env,
            stdio: ["pipe", "pipe", "pipe"],
          })
        : spawn(this.pythonPath, [this.resolvedScriptPath], {
            env,
            stdio: ["pipe", "pipe", "pipe"],
          });

      this.child = child as ChildProcessWithoutNullStreams;

      const onErr = (data: Buffer) => {
        process.stderr.write(data);
      };
      child.stderr?.on("data", onErr);

      child.on("error", (err) => {
        reject(err);
      });

      child.on("exit", (code, signal) => {
        this.child = null;
        this.rl = null;
        this.readyPromise = null;
        const msg = `MLX worker exited code=${code} signal=${signal}`;
        for (const [, p] of this.pending) {
          p.reject(new Error(msg));
        }
        this.pending.clear();
      });

      const rl = createInterface({ input: child.stdout });
      this.rl = rl;

      const timeout = setTimeout(() => {
        reject(
          new Error(
            `MLX worker ready timeout after ${this.readyTimeoutMs}ms (first run may download weights)`,
          ),
        );
        child.kill("SIGTERM");
      }, this.readyTimeoutMs);

      rl.once("line", (line: string) => {
        try {
          const o = JSON.parse(line) as { type?: string; message?: string };
          if (o.type === "error") {
            clearTimeout(timeout);
            reject(new Error(o.message ?? "MLX worker failed to start"));
            return;
          }
          if (o.type === "ready") {
            clearTimeout(timeout);
            rl.on("line", (l) => this.dispatchLine(l));
            resolve();
            return;
          }
          clearTimeout(timeout);
          reject(new Error(`MLX worker unexpected first line: ${line}`));
        } catch (e) {
          clearTimeout(timeout);
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });
    });

    await this.readyPromise;
  }

  private dispatchLine(line: string): void {
    let o: { id?: string; text?: string; error?: string | null };
    try {
      o = JSON.parse(line) as {
        id?: string;
        text?: string;
        error?: string | null;
      };
    } catch {
      return;
    }
    const id = o.id ?? "";
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    if (o.error) {
      p.reject(new Error(o.error));
    } else {
      p.resolve(typeof o.text === "string" ? o.text : "");
    }
  }

  /**
   * Single string or instruction/context split (worker merges into one Gemma user turn).
   */
  async generateUnstructured(prompt: string): Promise<string> {
    return this.complete(prompt);
  }

  private async complete(
    prompt: string | { system: string; user: string },
  ): Promise<string> {
    await this.ensureWorker();
    const child = this.child;
    const rl = this.rl;
    if (!child?.stdin || !rl) {
      throw new Error("MLX worker not available");
    }

    return this.withMutex(async () => {
      const id = `mlx${++this.requestId}`;
      return new Promise<string>((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        const payloadObj: Record<string, unknown> = {
          id,
          max_tokens: this.maxTokens,
          temp: this.mlxGenTemp,
        };
        if (typeof prompt === "string") {
          payloadObj.prompt = prompt;
        } else {
          payloadObj.system = prompt.system;
          payloadObj.prompt = prompt.user;
        }
        if (this.mlxStopStrings.length > 0) {
          payloadObj.stop = this.mlxStopStrings;
        }
        const payload = JSON.stringify(payloadObj) + "\n";
        try {
          child.stdin!.write(payload, (err) => {
            if (err) {
              this.pending.delete(id);
              reject(err);
            }
          });
        } catch (e) {
          this.pending.delete(id);
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });
    });
  }

  async interpretPlayerInput(
    userText: string,
    db: AdventureDatabase,
    options: InterpretPlayerInputOptions,
  ): Promise<InterpretedCommand> {
    const cacheDir = resolveCacheDir();
    const compact =
      options.promptStyle?.compact !== undefined
        ? options.promptStyle.compact
        : this.compactPrompts;
    const structuredDashboard =
      options.promptStyle?.structuredDashboard !== undefined
        ? options.promptStyle.structuredDashboard
        : resolveStructuredDashboardPrompts("mlx");
    const cacheKey = interpretCacheKeyFromBuildOptions({
      userText,
      modelId: this.modelId,
      providerId: this.providerId,
      recentGameText: options.recentGameText,
      compact,
      structuredDashboard,
    });

    const cacheHit = await loadCachedInterpretIfHit({
      cacheDir,
      cacheKey,
      db,
      userText,
      recentGameText: options.recentGameText,
      providerId: this.providerId,
      modelId: this.modelId,
    });
    if (cacheHit) return cacheHit;

    process.stderr.write("adventure-llm: translating with text LLM (MLX)…\n");

    const prompt = buildInterpretSystemAndUserPrompt(
      db,
      userText,
      options.recentGameText,
      {
        compact,
        structuredDashboard,
        providerId: this.providerId,
      },
    );

    await appendInteractionLog({
      event: "text_llm_request",
      provider: this.providerId,
      userText,
      model: this.modelId,
      promptLength: prompt.length,
      prompt,
    });

    const startedMs = Date.now();
    const rawText = await this.complete(prompt);
    const durationMs = Date.now() - startedMs;

    const parsedJson = parseJsonObjectFromLlmText(rawText);
    const rawCmd = InterpretedCommandSchema.parse(
      coerceInterpretedCommandJson(parsedJson),
    );
    const cmd = finalizeInterpretedCommand(
      db,
      userText,
      rawCmd,
      options.recentGameText,
    );

    await appendInteractionLog({
      event: "text_llm_response",
      provider: this.providerId,
      userText,
      model: this.modelId,
      cached: false,
      durationMs,
      rawJson: rawText,
      parsed: rawCmd,
      repaired: cmd,
    });

    if (cacheDir) {
      await writeCachedInterpreted(cacheDir, cacheKey, rawCmd);
    }

    return cmd;
  }

  async planAutoplay(
    db: AdventureDatabase,
    options: {
      plannerUserPrompt: PlannerUserPromptInput;
      recentGameTextForRepair?: string;
    },
  ): Promise<AutoplayPlannerResponse> {
    process.stderr.write(
      "adventure-llm: autoplay — planning next move (MLX)…\n",
    );

    let plannerBody = options.plannerUserPrompt;
    const recent = options.recentGameTextForRepair?.trim() ?? "";
    const twoStep = process.env.ADVENTURE_LLM_AUTOPLAY_TWO_STEP?.trim() === "1";
    if (twoStep && recent.length > 0) {
      const candidates = buildSituationalCandidateTokens(db, recent);
      if (candidates.length > 0) {
        process.stderr.write(
          "adventure-llm: autoplay — two-step token filter (MLX)…\n",
        );
        const filterPrompt = buildAutoplayRelevantTokensFilterPrompt(
          recent,
          candidates,
        );
        await appendInteractionLog({
          event: "text_llm_autoplay_filter_request",
          provider: this.providerId,
          model: this.modelId,
          promptLength: filterPrompt.length,
          prompt: filterPrompt,
        });
        const filterStarted = Date.now();
        let filterRaw = "";
        let narrowed: string[] = [];
        try {
          filterRaw = await this.complete(filterPrompt);
          const parsedUnknown = parseJsonObjectFromLlmText(filterRaw);
          narrowed = parseRelevantTokensResponse(
            parsedUnknown,
            new Set(candidates),
          );
        } catch {
          /* fall through to single-step body */
        }
        await appendInteractionLog({
          event: "text_llm_autoplay_filter_response",
          provider: this.providerId,
          model: this.modelId,
          durationMs: Date.now() - filterStarted,
          rawJson: filterRaw,
          narrowed,
        });
        if (narrowed.length > 0) {
          const filterNote = `## Two-step token filter (prefer these for primary and secondary)
${narrowed.join(", ")}`;
          plannerBody =
            typeof plannerBody === "string"
              ? `${filterNote}

${plannerBody}`
              : {
                  ...plannerBody,
                  user: `${filterNote}

${plannerBody.user}`,
                };
        }
      }
    }

    const compactOpts = { compact: this.compactPrompts };
    const toComplete =
      typeof plannerBody === "string"
        ? buildAutoplayPlannerPrompt(db, plannerBody, compactOpts)
        : buildAutoplayPlannerPromptParts(db, plannerBody, compactOpts);

    const mergedForLog =
      typeof toComplete === "string"
        ? toComplete
        : `${toComplete.system}\n\n${toComplete.user}`;

    await appendInteractionLog({
      event: "text_llm_autoplay_request",
      provider: this.providerId,
      model: this.modelId,
      promptLength: mergedForLog.length,
      prompt: mergedForLog,
      ...(typeof toComplete === "string"
        ? {}
        : { system: toComplete.system, user: toComplete.user }),
    });

    const startedMs = Date.now();
    const rawText = await this.complete(toComplete);
    const durationMs = Date.now() - startedMs;

    const parsedUnknown = parseJsonObjectFromLlmText(rawText);
    const raw = AutoplayPlannerResponseSchema.parse(
      coerceAutoplayPlannerJson(parsedUnknown),
    );
    const out = finalizeAutoplayPlannerResponse(
      db,
      raw,
      options.recentGameTextForRepair,
    );

    await appendInteractionLog({
      event: "text_llm_autoplay_response",
      provider: this.providerId,
      model: this.modelId,
      durationMs,
      rawJson: rawText,
      parsed: raw,
      repaired: out,
    });

    return out;
  }
}
