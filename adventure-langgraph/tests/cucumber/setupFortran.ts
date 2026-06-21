/**
 * Allow auto Fortran oracle detection (repo-root ./adventure + bridge script).
 */
delete process.env.ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE;

import "./http_world.js";
import "./http_hooks.js";
import "./steps/crt_steps.js";
