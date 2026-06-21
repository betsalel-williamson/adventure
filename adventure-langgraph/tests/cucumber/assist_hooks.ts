import { After, Before } from "@cucumber/cucumber";
import { createAssistApp } from "../../packages/assist-server/src/server.js";
import { closeServer } from "../../../adventure-v2/tests/helpers/closeServer.js";
import type { HttpWorld } from "./http_world.js";

Before({ tags: "@assist" }, async function (this: HttpWorld) {
  const app = createAssistApp();
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", reject);
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr !== null ? addr.port : 0;
  this.assistServer = server;
  this.assistBaseUrl = `http://127.0.0.1:${port}`;
});

After({ tags: "@assist" }, async function (this: HttpWorld) {
  if (this.assistServer) {
    await closeServer(this.assistServer);
    this.assistServer = undefined;
    this.assistBaseUrl = undefined;
  }
});
