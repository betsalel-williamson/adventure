import { RunCoordinator } from "./run/runCoordinator.js";
import { listenAdventureServer } from "./http/createServer.js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

listenAdventureServer(new RunCoordinator(), port, host)
  .then(({ baseUrl }) => {
    console.log(`adventure-v2 server listening at ${baseUrl}`);
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
