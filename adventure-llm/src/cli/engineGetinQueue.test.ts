import { describe, expect, it } from "vitest";
import { EngineGetinQueue } from "./engineGetinQueue.js";

describe("EngineGetinQueue", () => {
  it("resolves dequeue after enqueue (post after wait would block)", async () => {
    const q = new EngineGetinQueue();
    const p = q.dequeue();
    q.enqueue("east    ");
    await expect(p).resolves.toBe("east    ");
  });

  it("resolves dequeue immediately when enqueue happened first", async () => {
    const q = new EngineGetinQueue();
    q.enqueue("west    ");
    await expect(q.dequeue()).resolves.toBe("west    ");
  });

  it("passes null for session end", async () => {
    const q = new EngineGetinQueue();
    q.enqueue(null);
    await expect(q.dequeue()).resolves.toBe(null);
  });
});
