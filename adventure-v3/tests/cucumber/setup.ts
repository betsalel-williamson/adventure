/**
 * Cucumber loads this entry first (--import). Match adventure-v2 CI: deterministic synthetic oracle.
 */
process.env.ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE = "1";

import "./http_world.js";
import "./http_hooks.js";
import "./steps/crt_steps.js";
