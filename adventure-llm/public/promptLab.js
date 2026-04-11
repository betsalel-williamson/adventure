/**
 * Prompt experiment UI, projects, and LLM generation params (dashboard).
 * @param {{ fetch: typeof fetch }} ports
 * @param {ReturnType<import("./dashboardEnv.js").resolveDashboardElements>} el
 */
export function createPromptLab(ports, el) {
  const { fetch: f } = ports;
  const cred = { credentials: "same-origin" };
  const cf = (input, init = {}) => f(input, { ...cred, ...init });

  function patchToForm(patch) {
    if (!patch || typeof patch !== "object") return;
    if (el.promptSystemModeEl && patch.systemMode)
      el.promptSystemModeEl.value = patch.systemMode;
    if (el.promptIncludeDatHelpEl)
      el.promptIncludeDatHelpEl.checked =
        patch.includeDatHelpInSystem !== false;
    if (el.promptModelNotesTargetEl && patch.modelNotesTarget)
      el.promptModelNotesTargetEl.value = patch.modelNotesTarget;
    if (el.promptPatchSystemEl && patch.systemText != null)
      el.promptPatchSystemEl.value = patch.systemText;
    if (el.promptPatchUserPrefixEl && patch.userPrefix != null)
      el.promptPatchUserPrefixEl.value = patch.userPrefix;
    if (el.promptPatchUserSuffixEl && patch.userSuffix != null)
      el.promptPatchUserSuffixEl.value = patch.userSuffix;
    if (el.promptPatchModelNotesEl && patch.modelNotes != null)
      el.promptPatchModelNotesEl.value = patch.modelNotes;
  }

  function formToPatchBody() {
    return {
      systemMode: el.promptSystemModeEl?.value || "default",
      includeDatHelpInSystem: el.promptIncludeDatHelpEl?.checked !== false,
      modelNotesTarget: el.promptModelNotesTargetEl?.value || "system",
      systemText: el.promptPatchSystemEl?.value ?? "",
      userPrefix: el.promptPatchUserPrefixEl?.value ?? "",
      userSuffix: el.promptPatchUserSuffixEl?.value ?? "",
      modelNotes: el.promptPatchModelNotesEl?.value ?? "",
    };
  }

  async function fetchPromptExperiment() {
    const r = await cf("/api/prompt-experiment");
    if (!r.ok) return;
    const j = await r.json();
    if (j.patch) patchToForm(j.patch);
    if (el.promptActiveProjectEl) {
      el.promptActiveProjectEl.textContent = j.activeProjectId
        ? ` · project: ${j.activeProjectId}`
        : "";
    }
  }

  async function applyPromptPatch() {
    const r = await cf("/api/prompt-experiment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPatchBody()),
    });
    if (!r.ok) return false;
    const j = await r.json();
    if (j.patch) patchToForm(j.patch);
    return true;
  }

  function setLastSentFromSse(d) {
    const hasSplit =
      typeof d.fullSystem === "string" || typeof d.fullUser === "string";
    const hasMerged = typeof d.merged === "string";

    if (el.promptLastSplitWrap) {
      el.promptLastSplitWrap.classList.toggle("hidden", !hasSplit);
    }
    if (el.promptLastMergedWrap) {
      el.promptLastMergedWrap.classList.toggle(
        "hidden",
        !hasMerged || hasSplit,
      );
    }

    if (el.promptLastSystemEl && d.fullSystem != null) {
      el.promptLastSystemEl.value = d.fullSystem;
    }
    if (el.promptLastUserEl && d.fullUser != null) {
      el.promptLastUserEl.value = d.fullUser;
    }
    if (el.promptLastMergedEl && d.merged != null) {
      el.promptLastMergedEl.value = d.merged;
    }
  }

  async function refreshProjectList() {
    if (!el.promptProjectSelectEl) return;
    const r = await cf("/api/prompt-projects");
    if (!r.ok) return;
    const j = await r.json();
    const projects = Array.isArray(j.projects) ? j.projects : [];
    const active = j.activeId ?? null;
    const sel = el.promptProjectSelectEl;
    sel.replaceChildren();
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "(none)";
    sel.appendChild(blank);
    for (const p of projects) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name || p.id;
      sel.appendChild(o);
    }
    if (active && [...sel.options].some((o) => o.value === active)) {
      sel.value = active;
    } else {
      sel.value = "";
    }
  }

  async function refreshLlmGenFields() {
    if (!el.llmGenFieldsEl || !el.llmGenProviderEl) return;
    const r = await cf("/api/llm-generation-params");
    el.llmGenFieldsEl.replaceChildren();
    if (!r.ok) {
      el.llmGenProviderEl.textContent = "—";
      return;
    }
    const j = await r.json();
    el.llmGenProviderEl.textContent = `provider: ${j.providerId ?? "?"}`;
    const fields = Array.isArray(j.fields) ? j.fields : [];
    const values = j.values && typeof j.values === "object" ? j.values : {};
    for (const meta of fields) {
      if (!meta || meta.type !== "number" || !meta.key) continue;
      const wrap = document.createElement("label");
      wrap.className = "llm-gen-field";
      wrap.textContent = `${meta.key} `;
      const input = document.createElement("input");
      input.type = "number";
      input.dataset.genKey = meta.key;
      input.min = String(meta.min ?? "");
      input.max = String(meta.max ?? "");
      input.step = String(meta.step ?? "any");
      const v = values[meta.key];
      if (v !== undefined && Number.isFinite(v)) input.value = String(v);
      wrap.appendChild(input);
      el.llmGenFieldsEl.appendChild(wrap);
    }
  }

  async function applyLlmGenParams() {
    if (!el.llmGenFieldsEl) return false;
    const body = {};
    el.llmGenFieldsEl.querySelectorAll("input[data-gen-key]").forEach((inp) => {
      if (!(inp instanceof HTMLInputElement)) return;
      const k = inp.dataset.genKey;
      if (!k) return;
      const n = Number(inp.value);
      if (Number.isFinite(n)) body[k] = n;
    });
    const r = await cf("/api/llm-generation-params", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return false;
    const j = await r.json();
    if (j.values && el.llmGenFieldsEl) {
      for (const inp of el.llmGenFieldsEl.querySelectorAll(
        "input[data-gen-key]",
      )) {
        if (!(inp instanceof HTMLInputElement)) continue;
        const k = inp.dataset.genKey;
        if (!k) continue;
        const v = j.values[k];
        if (v !== undefined && Number.isFinite(v)) inp.value = String(v);
      }
    }
    return true;
  }

  function setStatus(targetEl, msg, isErr) {
    if (!targetEl) return;
    targetEl.textContent = msg;
    targetEl.classList.toggle("manual-error", Boolean(isErr));
  }

  function wirePromptLab() {
    el.promptExperimentApplyBtn?.addEventListener("click", () => {
      void applyPromptPatch().then((ok) => {
        setStatus(
          el.promptProjectStatusEl,
          ok ? "Patch applied." : "Patch failed.",
          !ok,
        );
      });
    });
    el.promptExperimentResetBtn?.addEventListener("click", () => {
      void fetchPromptExperiment().then(() =>
        setStatus(
          el.promptProjectStatusEl,
          "Reloaded patch from server.",
          false,
        ),
      );
    });

    el.promptProjectNewBtn?.addEventListener("click", () => {
      const name = globalThis.prompt?.("Project name", "Experiment") ?? "";
      void cf("/api/prompt-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Untitled" }),
      })
        .then(async (r) => {
          if (!r.ok) {
            setStatus(el.promptProjectStatusEl, "Create failed.", true);
            return;
          }
          await refreshProjectList();
          const j = await r.json();
          if (el.promptProjectSelectEl && j.id) {
            el.promptProjectSelectEl.value = j.id;
          }
          setStatus(el.promptProjectStatusEl, "Project created.", false);
        })
        .catch(() =>
          setStatus(el.promptProjectStatusEl, "Create failed.", true),
        );
    });

    el.promptProjectActivateBtn?.addEventListener("click", () => {
      const id = el.promptProjectSelectEl?.value?.trim();
      if (!id) {
        setStatus(el.promptProjectStatusEl, "Select a project first.", true);
        return;
      }
      void cf(`/api/prompt-projects/${encodeURIComponent(id)}/activate`, {
        method: "POST",
      })
        .then(async (r) => {
          if (!r.ok) {
            setStatus(el.promptProjectStatusEl, "Load failed.", true);
            return;
          }
          const j = await r.json();
          if (j.project?.promptExperiment)
            patchToForm(j.project.promptExperiment);
          if (el.promptActiveProjectEl)
            el.promptActiveProjectEl.textContent = ` · project: ${id}`;
          await refreshLlmGenFields();
          setStatus(
            el.promptProjectStatusEl,
            j.generationWarning
              ? `Loaded (gen: ${j.generationWarning})`
              : "Loaded project.",
            Boolean(j.generationWarning),
          );
        })
        .catch(() => setStatus(el.promptProjectStatusEl, "Load failed.", true));
    });

    el.promptProjectSaveDiskBtn?.addEventListener("click", () => {
      const id = el.promptProjectSelectEl?.value?.trim();
      if (!id) {
        setStatus(
          el.promptProjectStatusEl,
          "Select a project to overwrite.",
          true,
        );
        return;
      }
      void applyPromptPatch()
        .then(() => cf(`/api/prompt-projects/${encodeURIComponent(id)}`))
        .then(async (r) => {
          if (!r.ok) throw new Error("fetch");
          const rec = await r.json();
          const next = {
            ...rec,
            promptExperiment: formToPatchBody(),
            generationParams: {},
            updatedAt: new Date().toISOString(),
          };
          const gr = await cf("/api/llm-generation-params");
          if (gr.ok) {
            const gj = await gr.json();
            const pid = gj.providerId;
            const vals = gj.values || {};
            if (pid === "mlx")
              next.generationParams.mlx = {
                maxTokens: vals.maxTokens,
                temperature: vals.temperature,
              };
            else if (pid === "http")
              next.generationParams.http = {
                temperature: vals.temperature,
                maxTokens: vals.maxTokens,
              };
            else if (pid === "google")
              next.generationParams.google = {
                temperature: vals.temperature,
                maxOutputTokens: vals.maxOutputTokens,
              };
          }
          const pr = await cf(
            `/api/prompt-projects/${encodeURIComponent(id)}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(next),
            },
          );
          if (!pr.ok) throw new Error("put");
          setStatus(el.promptProjectStatusEl, "Saved to disk.", false);
          await refreshProjectList();
        })
        .catch(() => setStatus(el.promptProjectStatusEl, "Save failed.", true));
    });

    el.promptProjectDuplicateBtn?.addEventListener("click", () => {
      const id = el.promptProjectSelectEl?.value?.trim();
      if (!id) {
        setStatus(
          el.promptProjectStatusEl,
          "Select a project to duplicate.",
          true,
        );
        return;
      }
      const name =
        globalThis.prompt?.("New project name", "Copy")?.trim() || "Copy";
      void cf(`/api/prompt-projects/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
        .then(async (r) => {
          if (!r.ok) {
            setStatus(el.promptProjectStatusEl, "Duplicate failed.", true);
            return;
          }
          const j = await r.json();
          await refreshProjectList();
          if (el.promptProjectSelectEl && j.id) {
            el.promptProjectSelectEl.value = j.id;
          }
          setStatus(el.promptProjectStatusEl, "Duplicated.", false);
        })
        .catch(() =>
          setStatus(el.promptProjectStatusEl, "Duplicate failed.", true),
        );
    });

    el.promptProjectDeleteBtn?.addEventListener("click", () => {
      const id = el.promptProjectSelectEl?.value?.trim();
      if (!id) return;
      void cf(`/api/prompt-projects/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).then(async (r) => {
        if (!r.ok) {
          setStatus(el.promptProjectStatusEl, "Delete failed.", true);
          return;
        }
        await refreshProjectList();
        setStatus(el.promptProjectStatusEl, "Deleted.", false);
      });
    });

    el.llmGenApplyBtn?.addEventListener("click", () => {
      void applyLlmGenParams().then((ok) => {
        setStatus(
          el.llmGenStatusEl,
          ok ? "Generation params applied." : "Apply failed.",
          !ok,
        );
      });
    });
  }

  return {
    fetchPromptExperiment,
    refreshProjectList,
    refreshLlmGenFields,
    setLastSentFromSse,
    applyPromptPatch,
    wirePromptLab,
  };
}
