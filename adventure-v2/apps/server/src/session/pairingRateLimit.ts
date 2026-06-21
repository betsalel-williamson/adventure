export type PairingRedeemRateLimiterOptions = {
  maxAttempts?: number;
  windowMs?: number;
};

const DEFAULT_MAX_ATTEMPTS = 30;
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Sliding-window rate limiter for pairing redeem attempts (OWASP: throttle auth endpoints).
 */
export class PairingRedeemRateLimiter {
  readonly #maxAttempts: number;
  readonly #windowMs: number;
  readonly #attempts = new Map<string, number[]>();

  constructor(options: PairingRedeemRateLimiterOptions = {}) {
    this.#maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.#windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  }

  /** Returns true when the attempt is allowed and records it. */
  allow(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.#windowMs;
    const recent = (this.#attempts.get(key) ?? []).filter((t) => t > windowStart);
    if (recent.length >= this.#maxAttempts) {
      this.#attempts.set(key, recent);
      return false;
    }
    recent.push(now);
    this.#attempts.set(key, recent);
    return true;
  }
}

export const clientRateLimitKey = (remoteAddress: string | undefined): string =>
  remoteAddress?.trim() || "unknown";
