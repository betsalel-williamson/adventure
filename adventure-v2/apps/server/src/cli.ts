import { resolve } from "node:path";
import { RunCoordinator } from "./run/runCoordinator.js";
import { listenAdventureServer } from "./http/createServer.js";
import { createSyntheticOracleBridge } from "./oracle/oracleBridge.js";
import { createProcessOracleBridge } from "./oracle/processOracleBridge.js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const oracleScript = process.env.ADV_V2_PROCESS_ORACLE_SCRIPT?.trim();
const oracle =
  oracleScript !== undefined && oracleScript.length > 0
    ? createProcessOracleBridge({
        command: process.execPath,
        args: [resolve(oracleScript)]
      })
    : createSyntheticOracleBridge();

listenAdventureServer(new RunCoordinator(oracle), port, host)
  .then(({ baseUrl }) => {
    console.log(`adventure-v2 server listening at ${baseUrl}`);
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
