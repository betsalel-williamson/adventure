import type { ScriptedGetinLine } from "../engine/subprocessEngine.js";

/**
 * Async queue for browser-submitted GETIN lines (ADR0005). Safe if HTTP POST arrives before the
 * Fortran loop awaits the next line.
 */
export class EngineGetinQueue {
  private readonly buffer: Array<ScriptedGetinLine | null> = [];

  private waiter: ((v: ScriptedGetinLine | null) => void) | null = null;

  /**
   * `null` means the browser asked to end the Fortran session (no further GETIN).
   */
  enqueue(line: ScriptedGetinLine | null): void {
    if (this.waiter !== null) {
      const r = this.waiter;
      this.waiter = null;
      r(line);
      return;
    }
    this.buffer.push(line);
  }

  async dequeue(): Promise<ScriptedGetinLine | null> {
    if (this.buffer.length > 0) {
      return this.buffer.shift()!;
    }
    return await new Promise<ScriptedGetinLine | null>((resolve) => {
      this.waiter = resolve;
    });
  }
}
