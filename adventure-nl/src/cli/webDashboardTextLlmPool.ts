/**
 * Loaded {@link TextLlm} instances keyed by `providerId:modelId`. Dashboard sessions that
 * select the same pair **share one client** (reference-counted); no duplicate MLX subprocess
 * (or HTTP client) for the same preset. All LLM work is still driven through the process-wide
 * FIFO queue in `webDashboardLlmQueue.ts`, so only one request runs at a time. The pool cap
 * limits how many **distinct** presets may be loaded at once (default 2); entries with
 * `refCount === 0` may be LRU-evicted when making room.
 */
import {
  createGoogleTextLlmFromEnv,
  createHttpTextLlmFromEnv,
  createMlxTextLlmFromEnv,
} from "../nl/adventureTextLlm.js";
import { isAllowedGoogleWebModelId } from "../nl/googleWebModelPresets.js";
import { isAllowedHttpWebModelId } from "../nl/httpWebPresets.js";
import { isAllowedMlxWebModelId } from "../nl/mlxModelPresets.js";
import { MlxLmStdioTextLlm } from "../nl/providers/mlxLmStdioTextLlm.js";
import type { TextLlm, TextLlmProviderId } from "@adventure-nl/nl-glue";
import {
  googleBackendAvailableFromEnv,
  httpBackendAvailableFromEnv,
  mlxBackendAvailableFromEnv,
} from "../nl/textLlmWebBackends.js";

export function resolveWebMaxLoadedModels(): number {
  const raw = process.env.ADVENTURE_NL_WEB_MAX_LOADED_MODELS?.trim();
  if (raw === undefined || raw === "") return 2;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 32) return 2;
  return Math.floor(n);
}

export function poolKey(
  providerId: TextLlmProviderId,
  modelId: string,
): string {
  return `${providerId}:${modelId}`;
}

function splitPoolKey(key: string): [TextLlmProviderId, string] {
  const i = key.indexOf(":");
  if (i < 0) {
    throw new Error("TextLlmPool: invalid pool key");
  }
  return [key.slice(0, i) as TextLlmProviderId, key.slice(i + 1)];
}

type PoolEntry = {
  client: TextLlm;
  refCount: number;
  lastTouchedMs: number;
};

export type TextLlmPoolRuntime = {
  runSerialized: (fn: () => Promise<void>) => Promise<void>;
  broadcastAll: (event: string, payload: unknown) => void;
  broadcastOneSession: (
    sessionId: string,
    event: string,
    payload: unknown,
  ) => void;
  /** Clear pool attachment for sessions still bound to an entry that is being unloaded. */
  detachSessionsFromPoolKey: (poolKeyStr: string) => void;
  beginMlxModelLoad: (opts?: { canCancel?: boolean }) => void;
  endMlxModelLoad: () => void;
  mlxSwapInFlight: { current: MlxLmStdioTextLlm | null };
  mlxLoadCancelled: { current: boolean };
};

/** Subset of dashboard session fields the pool mutates (id matches session cookie). */
export type SessionModelBinding = {
  readonly id: string;
  textLlmProviderId: TextLlmProviderId;
  textLlmModelId: string;
  poolAttachedKey: string | null;
};

export class WebDashboardTextLlmPool {
  private readonly entries = new Map<string, PoolEntry>();

  constructor(
    private readonly maxEntries: number,
    private readonly rt: TextLlmPoolRuntime,
  ) {}

  getClient(key: string): TextLlm {
    const e = this.entries.get(key);
    if (!e) {
      throw new Error(`TextLlmPool: no loaded model for ${key}`);
    }
    return e.client;
  }

  getClientForSession(s: SessionModelBinding): TextLlm {
    return this.getClient(poolKey(s.textLlmProviderId, s.textLlmModelId));
  }

  /**
   * Ensure the session holds a pool reference matching its selected provider/model.
   */
  async ensureSessionAttached(s: SessionModelBinding): Promise<void> {
    const want = poolKey(s.textLlmProviderId, s.textLlmModelId);
    if (s.poolAttachedKey === want) {
      const e = this.entries.get(want);
      if (e) e.lastTouchedMs = Date.now();
      return;
    }
    await this.switchSessionToKey(s, want);
  }

  /** Attach pool to a new provider/model after validation; updates session fields only after success. */
  async switchSessionModel(
    s: SessionModelBinding,
    providerId: TextLlmProviderId,
    modelId: string,
  ): Promise<TextLlm> {
    const want = poolKey(providerId, modelId);
    await this.switchSessionToKey(s, want);
    s.textLlmProviderId = providerId;
    s.textLlmModelId = modelId;
    return this.getClient(want);
  }

  private pickEvictionVictim(): string | null {
    let best: { key: string; t: number } | null = null;
    for (const [key, e] of this.entries) {
      if (e.refCount > 0) continue;
      if (!best || e.lastTouchedMs < best.t) {
        best = { key, t: e.lastTouchedMs };
      }
    }
    return best?.key ?? null;
  }

  /** LRU among all loaded entries (used when every slot is still referenced). */
  private pickForceEvictionVictim(): string | null {
    let best: { key: string; t: number } | null = null;
    for (const [key, e] of this.entries) {
      if (!best || e.lastTouchedMs < best.t) {
        best = { key, t: e.lastTouchedMs };
      }
    }
    return best?.key ?? null;
  }

  private async disposeClient(client: TextLlm): Promise<void> {
    if (client instanceof MlxLmStdioTextLlm) {
      await client.waitForIdle().catch(() => {
        /* ignore */
      });
      await client.dispose().catch(() => {
        /* ignore */
      });
    }
  }

  private async disposeEntryKey(key: string): Promise<void> {
    const e = this.entries.get(key);
    if (!e) return;
    this.entries.delete(key);
    await this.disposeClient(e.client);
  }

  private async makeRoomForNewKeyIfNeeded(newKey: string): Promise<void> {
    while (this.entries.size >= this.maxEntries && !this.entries.has(newKey)) {
      const victim =
        this.pickEvictionVictim() ?? this.pickForceEvictionVictim();
      if (!victim) {
        throw new Error(
          `At most ${this.maxEntries} loaded text model(s) allowed (ADVENTURE_NL_WEB_MAX_LOADED_MODELS).`,
        );
      }
      this.rt.detachSessionsFromPoolKey(victim);
      await this.disposeEntryKey(victim);
    }
  }

  private async releaseRef(key: string | null): Promise<void> {
    if (key === null) return;
    const e = this.entries.get(key);
    if (!e) return;
    e.refCount -= 1;
    if (e.refCount <= 0) {
      await this.disposeEntryKey(key);
    }
  }

  private async instantiate(
    providerId: TextLlmProviderId,
    modelId: string,
    notifySession: SessionModelBinding,
  ): Promise<TextLlm> {
    if (providerId === "mlx") {
      if (!mlxBackendAvailableFromEnv()) {
        throw new Error("MLX not configured in environment");
      }
      if (!isAllowedMlxWebModelId(modelId)) {
        throw new Error("Unknown or disallowed MLX model id");
      }
      this.rt.beginMlxModelLoad({ canCancel: true });
      this.rt.mlxLoadCancelled.current = false;
      try {
        process.stderr.write(
          `adventure-nl: loading MLX model ${modelId} (pooled)…\n`,
        );
        const created = createMlxTextLlmFromEnv(modelId, {
          onWorkerStderr: (chunk: string) =>
            this.rt.broadcastAll("mlx_load_progress", { chunk }),
        });
        this.rt.mlxSwapInFlight.current = created;
        try {
          await created.preloadWorker();
        } catch (loadErr) {
          if (this.rt.mlxLoadCancelled.current) {
            await created.dispose().catch(() => {
              /* ignore */
            });
            this.rt.broadcastOneSession(
              notifySession.id,
              "mlx_load_cancelled",
              {
                providerId: notifySession.textLlmProviderId,
                modelId: notifySession.textLlmModelId,
              },
            );
            throw loadErr;
          }
          throw loadErr;
        } finally {
          this.rt.mlxSwapInFlight.current = null;
          this.rt.mlxLoadCancelled.current = false;
        }
        return created;
      } finally {
        this.rt.endMlxModelLoad();
      }
    }

    if (providerId === "http") {
      if (!httpBackendAvailableFromEnv()) {
        throw new Error("HTTP text model not configured");
      }
      if (!isAllowedHttpWebModelId(modelId)) {
        throw new Error("Unknown or disallowed HTTP model id");
      }
      const nu = createHttpTextLlmFromEnv(modelId);
      if (!nu) throw new Error("HTTP text model not configured");
      return nu;
    }

    if (providerId === "google") {
      if (!googleBackendAvailableFromEnv()) {
        throw new Error("Gemini not configured");
      }
      if (!isAllowedGoogleWebModelId(modelId)) {
        throw new Error("Unknown or disallowed Gemini model id");
      }
      const nu = createGoogleTextLlmFromEnv(modelId);
      if (!nu) throw new Error("Gemini not configured");
      return nu;
    }

    throw new Error("Unknown provider");
  }

  private async switchSessionToKey(
    s: SessionModelBinding,
    wantKey: string,
  ): Promise<void> {
    await this.rt.runSerialized(async () => {
      if (s.poolAttachedKey === wantKey) {
        const ex = this.entries.get(wantKey);
        if (ex) ex.lastTouchedMs = Date.now();
        return;
      }

      const existing = this.entries.get(wantKey);
      if (existing) {
        await this.releaseRef(s.poolAttachedKey);
        existing.refCount += 1;
        existing.lastTouchedMs = Date.now();
        s.poolAttachedKey = wantKey;
        return;
      }

      const oldKey = s.poolAttachedKey;
      await this.releaseRef(oldKey);
      s.poolAttachedKey = null;

      await this.makeRoomForNewKeyIfNeeded(wantKey);
      const [pid, mid] = splitPoolKey(wantKey);
      const client = await this.instantiate(pid, mid, s);
      this.entries.set(wantKey, {
        client,
        refCount: 1,
        lastTouchedMs: Date.now(),
      });
      s.poolAttachedKey = wantKey;
    });
  }
}
