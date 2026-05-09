/**
 * Cucumber loads this entry first (--import). Register World before hooks/steps.
 */
process.env.ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE = "1";

import "./http_world.js";
import "./http_hooks.js";
import "./http_steps.js";
