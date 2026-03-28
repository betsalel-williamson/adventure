import type { TextLlmProviderId } from "./textLlmContract.js";

/** HTTP / transport failure with optional status (OpenAI-compatible APIs). */
export class LlmTransportError extends Error {
  readonly status?: number;
  readonly bodySnippet?: string;

  constructor(
    message: string,
    options?: { cause?: unknown; status?: number; bodySnippet?: string },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "LlmTransportError";
    this.status = options?.status;
    this.bodySnippet = options?.bodySnippet;
  }
}

export function isLlmTransportError(err: unknown): err is LlmTransportError {
  return err instanceof LlmTransportError;
}

/** Transient HTTP statuses where a retry may help. */
export function httpStatusEligibleForRetry(status: number): boolean {
  return status === 429 || status === 503 || status === 502 || status === 500;
}

function httpStatusFromError(err: unknown): number | undefined {
  if (isLlmTransportError(err)) return err.status;
  if (typeof err === "object" && err !== null && "status" in err) {
    const s = (err as { status: unknown }).status;
    if (typeof s === "number") return s;
  }
  return undefined;
}

/** @deprecated Use {@link shouldFallbackToClassicForLlmError} with provider `"google"`. */
export function shouldFallbackToClassicForGeminiError(err: unknown): boolean {
  return shouldFallbackToClassicForLlmError(err, "google");
}

/**
 * Whether the CLI should fall back to classic Fortran TTY (interactive) or stop (autoplay).
 */
export function shouldFallbackToClassicForLlmError(
  err: unknown,
  provider: TextLlmProviderId,
): boolean {
  if (err === null || err === undefined) return false;

  if (provider === "google") {
    const s = httpStatusFromError(err);
    if (s !== undefined) {
      if (s === 429 || s === 500 || s === 502 || s === 503) return true;
      if (s === 401 || s === 403) return true;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (
      /429|quota|rate limit|too many requests|resource_exhausted|unavailable|overloaded/i.test(
        msg,
      )
    ) {
      return true;
    }
    return false;
  }

  // http (OpenAI-compatible) and mlx (Python subprocess)
  if (provider === "http" || provider === "mlx") {
    const s = httpStatusFromError(err);
    if (s !== undefined) {
      if (s === 429 || s === 500 || s === 502 || s === 503) return true;
      if (s === 401 || s === 403) return true;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (
      /429|quota|rate limit|503|502|500|ECONNREFUSED|ENOTFOUND|fetch failed|network|socket|EPIPE|ENOENT|MLX|mlx|python|subprocess/i.test(
        msg,
      )
    ) {
      return true;
    }
    return false;
  }

  return false;
}
