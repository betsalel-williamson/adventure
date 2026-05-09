import { basename } from "node:path";
import { RunCoordinator } from "./run/runCoordinator.js";
import { listenAdventureServer } from "./http/createServer.js";
import { createSyntheticOracleBridge } from "./oracle/oracleBridge.js";
import { createProcessOracleBridge } from "./oracle/processOracleBridge.js";
import { resolveOracleStartupConfig } from "./oracle/oracleStartupConfig.js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const oracleCfg = resolveOracleStartupConfig();
const oracle =
  oracleCfg.kind === "process"
    ? createProcessOracleBridge({
        command: process.execPath,
        args: [oracleCfg.scriptPath]
      })
    : createSyntheticOracleBridge();

listenAdventureServer(new RunCoordinator(oracle), port, host)
  .then(({ baseUrl }) => {
    const oracleMsg =
      oracleCfg.kind === "process"
        ? `${oracleCfg.reason} · ${basename(oracleCfg.scriptPath)}`
        : `synthetic · ${oracleCfg.reason}`;
    console.log("");
    console.log(`adventure-v2 · HTTP API ready · ${baseUrl}`);
    console.log(
      "  Sessions · POST /runs  ·  Turns · POST /runs/:runId/turns  ·  SSE · GET /runs/:runId/events"
    );
    console.log(`  Game oracle · ${oracleMsg}`);
    console.log(
      "  Web shell · from adventure-v2/: npm run dev (API + Vite) → open http://127.0.0.1:5173"
    );
    console.log("");
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
