import { describe, expect, it } from "vitest";
import { createLlmSequentialExecutor } from "./webDashboardLlmQueue.js";

describe("createLlmSequentialExecutor", () => {
  it("runs jobs in FIFO order", async () => {
    const ex = createLlmSequentialExecutor();
    const order: number[] = [];
    const p1 = ex.run("session-a", async () => {
      await new Promise((r) => setTimeout(r, 25));
      order.push(1);
      return 1;
    });
    const p2 = ex.run("session-a", async () => {
      order.push(2);
      return 2;
    });
    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });

  it("advances to the next job after rejection", async () => {
    const ex = createLlmSequentialExecutor();
    const runs: string[] = [];
    const p1 = ex.run("session-a", async () => {
      runs.push("a");
      throw new Error("fail");
    });
    const p2 = ex.run("session-b", async () => {
      runs.push("b");
      return "ok";
    });
    await expect(p1).rejects.toThrow("fail");
    await expect(p2).resolves.toBe("ok");
    expect(runs).toEqual(["a", "b"]);
  });

  it("flush resolves after the chain is idle", async () => {
    const ex = createLlmSequentialExecutor();
    let done = false;
    void ex.run("session-a", async () => {
      await new Promise((r) => setTimeout(r, 15));
      done = true;
      return 1;
    });
    await ex.flush();
    expect(done).toBe(true);
  });
});
