import { After, Before } from "@cucumber/cucumber";
import {
  RunCoordinator,
  listenAdventureServer,
  createSyntheticOracleBridge,
  createProcessOracleBridge,
  createPersistentFortranOracleBridge,
  resolveOracleStartupConfig
} from "../../../adventure-v2/apps/server/src/index.js";
import { closeServer } from "../../../adventure-v2/tests/helpers/closeServer.js";
import type { HttpWorld } from "./http_world.js";

Before(async function (this: HttpWorld) {
  const oracleCfg = resolveOracleStartupConfig();
  const oracle =
    oracleCfg.kind === "process" && oracleCfg.mode === "bridge_script"
      ? createProcessOracleBridge({
          command: process.execPath,
          args: [oracleCfg.scriptPath]
        })
      : oracleCfg.kind === "process" && oracleCfg.mode === "persistent_fortran"
        ? createPersistentFortranOracleBridge({
            repoRoot: oracleCfg.repoRoot,
            adventureBinary: oracleCfg.adventureBinary
          })
        : createSyntheticOracleBridge();
  this.coordinator = new RunCoordinator(oracle);
  const { server, baseUrl } = await listenAdventureServer(this.coordinator, 0);
  this.server = server;
  this.baseUrl = baseUrl;
});

After(async function (this: HttpWorld) {
  if (this.server) {
    await closeServer(this.server);
  }
});
