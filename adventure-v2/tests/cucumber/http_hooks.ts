import { After, Before } from "@cucumber/cucumber";
import { RunCoordinator, listenAdventureServer } from "../../apps/server/src/index.js";
import { closeServer } from "../helpers/closeServer.js";
import type { HttpWorld } from "./http_world.js";

Before(async function (this: HttpWorld) {
  this.coordinator = new RunCoordinator();
  const { server, baseUrl } = await listenAdventureServer(this.coordinator, 0);
  this.server = server;
  this.baseUrl = baseUrl;
});

After(async function (this: HttpWorld) {
  if (this.server) {
    await closeServer(this.server);
  }
});
