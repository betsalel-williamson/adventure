import { describe, expect, it } from "vitest";
import { MlxLmStdioTextLlm } from "./mlxLmStdioTextLlm.js";

describe("MlxLmStdioTextLlm.dispose", () => {
  it("completes when no worker was started", async () => {
    const llm = new MlxLmStdioTextLlm({
      modelId: "mlx-community/gemma-2-2b-it",
    });
    await expect(llm.dispose()).resolves.toBeUndefined();
    await expect(llm.dispose()).resolves.toBeUndefined();
  });
});
