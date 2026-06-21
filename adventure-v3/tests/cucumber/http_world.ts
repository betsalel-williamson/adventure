import type { Server } from "node:http";
import {
  World,
  setWorldConstructor,
  type IWorldOptions,
} from "@cucumber/cucumber";
import type {
  OracleBridge,
  RunCoordinator,
} from "../../../adventure-v2/apps/server/src/index.js";
import type { SseWireEvent } from "../../../adventure-v2/packages/contracts/src/index.js";

export class HttpWorld extends World {
  constructor(options: IWorldOptions) {
    super(options);
  }

  server?: Server;
  coordinator?: RunCoordinator;
  oracleBridge?: OracleBridge;
  baseUrl?: string;
  runId?: string;
  readPromise?: Promise<SseWireEvent[]>;
  wire?: SseWireEvent[];
  healthBody?: Record<string, unknown>;
  /** Last JSON from `GET /assist/health` (only @assist scenarios). */
  assistHealthBody?: Record<string, unknown>;
  /** Assist HTTP app (only for @assist scenarios). */
  assistServer?: Server;
  assistBaseUrl?: string;
  assistIngestBody?: Record<string, unknown>;
}

setWorldConstructor(HttpWorld);
