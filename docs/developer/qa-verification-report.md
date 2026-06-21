# QA verification report

Local evidence pack produced **before opening a PR** or when handing work to a reviewer. Confirms that issue acceptance criteria are met with **reproducible artifacts** — not just green tests in chat.

Reports live under **`.caches/qa-reports/`** (gitignored). **Do not commit** QA reports to the repository; paste the executive summary into the PR **Test plan** section or attach the file in the PR comment if helpful.

## When to produce

| Situation | Action |
| --- | --- |
| Issue has HTTP/API acceptance criteria | Required — include live demo section |
| Contract / OpenAPI change | Required — include path or schema evidence |
| Pure refactor with existing test coverage | Optional — targeted test output may suffice |
| Doc-only issue | Skip — use `make docs-check` output instead |

Agents and contributors: produce the report after **Green** (tests pass) and before step **PR** in [TDD + GitHub workflow](tdd-and-github-workflow.md). Auth/session changes also require a committed [security review](security-review-workflow.md).

## File naming and location

```text
.caches/qa-reports/
├── <work-key>-qa-report.md      # Main report (e.g. s1-session-auth-qa-report.md)
├── <work-key>-test-output.txt   # Raw vitest capture (optional)
├── <work-key>-live-output.txt   # Raw live HTTP demo (optional)
└── <work-key>-live-demo.mjs     # Re-runnable demo script (optional)
```

Convention: `<work-key>` matches the branch (`cloud-deploy/s1-session-auth` → `s1-session-auth`).

## Report structure

Use this outline for every report. Copy into a new file and fill in.

```markdown
# QA Report — #N WORK_KEY Short title

**Generated:** YYYY-MM-DD (local, not committed)
**Branch:** `cloud-deploy/<work-key>-<slug>`
**Issue:** [#N — title](https://github.com/…/issues/N)
**Location:** `.caches/qa-reports/<work-key>-qa-report.md` (gitignored)

---

## Executive summary

| Check | Result |
| --- | --- |
| Issue-targeted automated tests | **X/X PASS** |
| Regression suite (package or repo) | **Y/Y PASS** |
| Live demo (if applicable) | **Z/Z scenarios PASS** |
| Contract / OpenAPI evidence (if applicable) | … |
| Issue #N acceptance criteria | **A/A evidenced below** |

---

## Acceptance criteria traceability

| # | Acceptance criterion (from issue body) | Evidence |
| --- | --- | --- |
| 1 | … | Test name, live JSON snippet, doc path, or command output |
| 2 | … | … |

---

## Automated test evidence

(Paste verbose vitest output for the issue-targeted test file, then regression summary.)

Full raw output: `.caches/qa-reports/<work-key>-test-output.txt`

---

## Live HTTP evidence (when applicable)

Ephemeral server on random port; capture request/response JSON per scenario.

Raw capture: `.caches/qa-reports/<work-key>-live-output.txt`
Re-run: `cd <package> && npx tsx ../.caches/qa-reports/<work-key>-live-demo.mjs`

---

## OpenAPI / contract evidence (when applicable)

List paths or schema refs with line numbers or `rg` output after `npm run openapi:generate`.

---

## Files changed (for review)

Brief list of new/modified paths — helps reviewer orient without reading the whole diff.

---

## How to reproduce

Exact commands from repo root or package directory.

---

## Artifacts in this folder

| File | Purpose |
| --- | --- |
| `<work-key>-qa-report.md` | This report |
| `<work-key>-test-output.txt` | Raw vitest output |
| `<work-key>-live-output.txt` | Raw live demo output |
| `<work-key>-live-demo.mjs` | Re-runnable demo script |
```

## Three evidence layers

| Layer | What it proves | Typical command |
| --- | --- | --- |
| **1. Targeted tests** | Each acceptance criterion has an automated check | `npm test -- tests/<issue>.test.ts --reporter=verbose` |
| **2. Regression** | Change did not break existing behavior | `npm test` (package) or targeted monorepo gates |
| **3. Live demo** | Runtime behavior matches spec (status codes, headers, JSON bodies) | Ephemeral server + `fetch`/`curl`; capture stdout to `.txt` |

Layer 3 is especially important when tests mock internals but reviewers need proof the HTTP surface behaves correctly.

## HTTP status semantics in reports

Distinguish **criterion pass** from **HTTP success**:

| Status | Report language | Meaning |
| --- | --- | --- |
| **2xx** | HTTP success | Operation completed |
| **401 / 403** | Auth gate **PASS** (when testing rejection) | Expected denial |
| **501 Not Implemented** | Auth **PASS**, capability **OUT OF SCOPE** | Route exists; auth ran; handler deliberately stubbed for a later issue (e.g. inference relay in I4). **Not** operational success — clients and monitors should treat 501 as failure |
| **410 Gone** | Expected lifecycle **PASS** | Expired or consumed resource (e.g. single-use pairing code) |

Example (S1): `POST /inference/plan` without cookie → **401** proves session checks; with cookie → **501** proves auth passed before the I4 stub — not that inference works.

## Producing a report (quick recipe)

From repo root, for a package under test (example: `adventure-v2`):

```bash
mkdir -p .caches/qa-reports

cd adventure-v2

# Layer 1 + 2 — capture raw output
npm test -- tests/session-auth.test.ts --reporter=verbose 2>&1 | tee ../.caches/qa-reports/s1-test-output.txt
npm test 2>&1 | tee -a ../.caches/qa-reports/s1-test-output.txt

# Layer 3 — optional live demo script (keep in .caches/, import from package via tsx)
npx tsx ../.caches/qa-reports/s1-live-demo.mjs 2>&1 | tee ../.caches/qa-reports/s1-live-output.txt

# OpenAPI evidence (when contracts changed)
npm run openapi:generate
rg "^  /" openapi.yaml   # or paths relevant to the issue
```

Then assemble `s1-session-auth-qa-report.md` from the template above, linking raw captures and mapping each issue acceptance criterion to evidence.

## PR and review handoff

1. Paste the **Executive summary** and **Acceptance criteria traceability** tables into the PR **Test plan** section ([`.github/pull_request_template.md`](../../.github/pull_request_template.md)).
2. Note the local report path so reviewers can open it: `.caches/qa-reports/<work-key>-qa-report.md`.
3. Reviewers re-run **How to reproduce** commands to confirm.

## Reference example

The first report in this format was produced for **#6 S1** (session auth + pairing) on branch `cloud-deploy/s1-session-auth`. If the report still exists locally, open:

`.caches/qa-reports/s1-session-auth-qa-report.md`

## Related

- [Security review workflow](security-review-workflow.md)
- [TDD + GitHub workflow](tdd-and-github-workflow.md)
- [Agent work-item tracking](agent-work-item-tracking.md)
- [v3 testing](v3-testing.md) — langgraph verify gates (separate from this report format)
