import { execFileSync } from "node:child_process";

export type GitWorktreeMeta = {
  readonly commitSha: string | null;
  readonly dirty: boolean;
};

export function readGitWorktreeMeta(repoRoot: string): GitWorktreeMeta {
  try {
    const sha = execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
      timeout: 5000,
    })
      .trim()
      .slice(0, 64);
    if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
      return { commitSha: null, dirty: false };
    }
    let dirty = false;
    try {
      const st = execFileSync(
        "git",
        ["-C", repoRoot, "status", "--porcelain"],
        { encoding: "utf8", timeout: 5000 },
      ).trim();
      dirty = st.length > 0;
    } catch {
      dirty = false;
    }
    return { commitSha: sha, dirty };
  } catch {
    return { commitSha: null, dirty: false };
  }
}
