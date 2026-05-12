import { z } from "zod";

const assistStepOkSchema = z.object({
  status: z.literal("ok"),
  nextMove: z.string().nullable().optional(),
  mapJson: z.unknown().nullable().optional(),
  mermaid: z.string().optional(),
  notice: z.string().optional(),
});

const assistStepErrSchema = z.object({
  status: z.literal("error"),
  errorMessage: z.string().optional(),
});

export type AssistStepRequest = {
  readonly runId: string;
  readonly transcript: string;
  readonly assistancePosture: "quickAssist" | "studyFirst";
  readonly studyFirstConfirmed: boolean;
  readonly advance?: boolean;
};

export type AssistStepResult =
  | {
      readonly ok: true;
      readonly nextMove: string | null;
      readonly mapJson: unknown;
      readonly mermaid: string;
      readonly notice?: string;
    }
  | { readonly ok: false; readonly error: string };

export type AssistIngestRequest = {
  readonly runId: string;
  readonly transcript: string;
  readonly line: string;
  readonly context: {
    readonly priorLines: readonly string[];
    readonly currentPlaceId: string | null;
  };
  readonly patch?: unknown;
};

export type AssistIngestResult =
  | {
      readonly ok: true;
      readonly mapJson: unknown;
      readonly mermaid: string;
    }
  | { readonly ok: false; readonly error: string };

const assistBaseUrl = (): string =>
  import.meta.env.VITE_ASSIST_URL ?? "http://127.0.0.1:8790";

export const postAssistStep = async (
  body: AssistStepRequest,
): Promise<AssistStepResult> => {
  const url = `${assistBaseUrl().replace(/\/$/, "")}/assist/step`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Assist unreachable (${url}): ${msg}` };
  }

  const data: unknown = await res.json().catch(() => ({}));
  const err = assistStepErrSchema.safeParse(data);
  if (err.success) {
    return {
      ok: false,
      error: err.data.errorMessage ?? `Assist HTTP ${res.status}`,
    };
  }

  const ok = assistStepOkSchema.safeParse(data);
  if (!ok.success || !res.ok) {
    return {
      ok: false,
      error: `Assist bad response HTTP ${res.status}`,
    };
  }

  const d = ok.data;
  return {
    ok: true,
    nextMove: d.nextMove ?? null,
    mapJson: d.mapJson ?? null,
    mermaid: d.mermaid ?? "",
    notice: d.notice,
  };
};

const assistIngestOkSchema = z.object({
  status: z.literal("ok"),
  mapJson: z.unknown(),
  mermaid: z.string().optional(),
});

export const postAssistIngest = async (
  body: AssistIngestRequest,
): Promise<AssistIngestResult> => {
  const url = `${assistBaseUrl().replace(/\/$/, "")}/assist/ingest`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Assist unreachable (${url}): ${msg}` };
  }

  const data: unknown = await res.json().catch(() => ({}));
  const err = assistStepErrSchema.safeParse(data);
  if (err.success) {
    return {
      ok: false,
      error: err.data.errorMessage ?? `Assist HTTP ${res.status}`,
    };
  }

  const ok = assistIngestOkSchema.safeParse(data);
  if (!ok.success || !res.ok) {
    return {
      ok: false,
      error: `Assist bad response HTTP ${res.status}`,
    };
  }

  return {
    ok: true,
    mapJson: ok.data.mapJson,
    mermaid: ok.data.mermaid ?? "",
  };
};
