import type {
  CognitionTraceWire,
  TurnEnvelope
} from "../../../../packages/contracts/src/index.js";
import type { PhaseTransitionEvent } from "../../../../packages/control/src/index.js";

export type WireStreamItem =
  | { type: "turn"; envelope: TurnEnvelope }
  | { type: "phase"; transition: PhaseTransitionEvent }
  | { type: "trace"; trace: CognitionTraceWire };
