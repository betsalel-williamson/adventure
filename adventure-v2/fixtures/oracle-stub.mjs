#!/usr/bin/env node
/**
 * Fixture oracle: one line JSON stdin → one line JSON stdout.
 * Protocol: docs/architecture/adventure-v2/oracle-subprocess-ipc.md
 */
import * as readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.once("line", (line) => {
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    process.stderr.write("stub: invalid request json\n");
    process.exit(1);
  }

  const action = typeof req.action === "string" ? req.action : "";
  const forceReject = Boolean(req.forceReject);

  if (forceReject) {
    console.log(JSON.stringify({ rejected: true, output: "stub-line: forced reject" }));
    process.exit(0);
  }

  if (action === "__PROCESS_ORACLE_LINE__") {
    console.log(
      JSON.stringify({ rejected: false, output: "PROCESS-ORACLE-STUB-LINE" })
    );
    process.exit(0);
  }

  console.log(JSON.stringify({ rejected: false, output: `stub-echo:${action}` }));
  process.exit(0);
});
