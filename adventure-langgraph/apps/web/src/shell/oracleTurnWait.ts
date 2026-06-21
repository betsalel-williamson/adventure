/**
 * Coordinates "wait until oracle_observation is painted" with POST /turns.
 * One gate per shell session; bootstrap oracle lines do not arm the gate.
 */
export type OracleTurnWaitGate = {
  beginWait: () => { promise: Promise<void>; cancel: () => void };
  /** Call after oracle/game text is appended and rendered (SSE oracle_observation path). */
  notifyOraclePainted: () => void;
};

export function createOracleTurnWaitGate(): OracleTurnWaitGate {
  let pendingUnlock: (() => void) | null = null;

  const beginWait = (): { promise: Promise<void>; cancel: () => void } => {
    let settled = false;
    let resolveWait!: () => void;
    const promise = new Promise<void>((resolve) => {
      resolveWait = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };
    });
    pendingUnlock = resolveWait;
    const cancel = (): void => {
      pendingUnlock = null;
      if (!settled) {
        resolveWait();
      }
    };
    return { promise, cancel };
  };

  const notifyOraclePainted = (): void => {
    if (pendingUnlock) {
      const unlock = pendingUnlock;
      pendingUnlock = null;
      unlock();
    }
  };

  return { beginWait, notifyOraclePainted };
}
