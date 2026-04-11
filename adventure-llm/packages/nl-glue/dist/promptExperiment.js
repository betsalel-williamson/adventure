export const defaultPromptExperimentPatch = () => ({
    systemMode: "default",
    systemText: "",
    userPrefix: "",
    userSuffix: "",
    modelNotes: "",
    modelNotesTarget: "system",
    includeDatHelpInSystem: true,
});
function trimOpt(s) {
    return typeof s === "string" ? s.trim() : "";
}
/**
 * Applies experiment patch on top of the session-memory-built planner input.
 */
export function applyPlannerPromptExperiment(baseline, patch) {
    const systemMode = patch.systemMode ?? "default";
    const systemText = trimOpt(patch.systemText);
    const userPrefix = trimOpt(patch.userPrefix);
    const userSuffix = trimOpt(patch.userSuffix);
    const modelNotes = trimOpt(patch.modelNotes);
    const modelTarget = patch.modelNotesTarget ?? "system";
    if (typeof baseline === "string") {
        let s = baseline;
        if (systemMode === "replace" && systemText) {
            s = systemText;
            if (modelNotes) {
                s = s === "" ? modelNotes : `${modelNotes}\n\n${s}`;
            }
        }
        else {
            if (systemMode === "append" && systemText) {
                s = `${systemText}\n\n${s}`;
            }
            if (modelNotes) {
                s = s === "" ? modelNotes : `${modelNotes}\n\n${s}`;
            }
        }
        if (userPrefix)
            s = `${userPrefix}\n${s}`;
        if (userSuffix)
            s = `${s}\n${userSuffix}`;
        return s;
    }
    let system = baseline.system;
    let user = baseline.user;
    if (systemMode === "replace" && systemText) {
        system = systemText;
    }
    else if (systemMode === "append" && systemText) {
        system =
            system.trim() === "" ? systemText : `${system.trim()}\n\n${systemText}`;
    }
    if (modelNotes) {
        if (modelTarget === "user_top") {
            user = user.trim() === "" ? modelNotes : `${modelNotes}\n\n${user}`;
        }
        else {
            system =
                system.trim() === "" ? modelNotes : `${system.trim()}\n\n${modelNotes}`;
        }
    }
    if (userPrefix)
        user = `${userPrefix}\n${user}`;
    if (userSuffix)
        user = `${user}\n${userSuffix}`;
    return { system: system.trim(), user: user.trim() };
}
function isSystemMode(v) {
    return v === "default" || v === "replace" || v === "append";
}
function isNotesTarget(v) {
    return v === "system" || v === "user_top";
}
/**
 * Shallow-merge JSON body into an existing patch (dashboard PATCH /api/prompt-experiment).
 */
export function patchPromptExperimentPatch(current, body) {
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return current;
    }
    const b = body;
    return {
        systemMode: isSystemMode(b.systemMode) ? b.systemMode : current.systemMode,
        systemText: typeof b.systemText === "string" ? b.systemText : current.systemText,
        userPrefix: typeof b.userPrefix === "string" ? b.userPrefix : current.userPrefix,
        userSuffix: typeof b.userSuffix === "string" ? b.userSuffix : current.userSuffix,
        modelNotes: typeof b.modelNotes === "string" ? b.modelNotes : current.modelNotes,
        modelNotesTarget: isNotesTarget(b.modelNotesTarget)
            ? b.modelNotesTarget
            : current.modelNotesTarget,
        includeDatHelpInSystem: typeof b.includeDatHelpInSystem === "boolean"
            ? b.includeDatHelpInSystem
            : current.includeDatHelpInSystem,
    };
}
//# sourceMappingURL=promptExperiment.js.map