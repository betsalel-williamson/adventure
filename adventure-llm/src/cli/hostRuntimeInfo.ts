import { execFileSync } from "node:child_process";
import os from "node:os";

export type HostRuntimeInfo = {
  readonly platform: string;
  readonly release: string;
  readonly arch: string;
  readonly hostname: string;
  readonly nodeVersion: string;
  /** Best-effort CPU model string (macOS sysctl); may be empty. */
  readonly cpuModel?: string;
};

let cachedCpuModel: string | undefined;

function readCpuModelSync(): string | undefined {
  if (cachedCpuModel !== undefined) return cachedCpuModel;
  if (process.platform !== "darwin") {
    cachedCpuModel = "";
    return undefined;
  }
  try {
    const out = execFileSync(
      "/usr/sbin/sysctl",
      ["-n", "machdep.cpu.brand_string"],
      { encoding: "utf8", timeout: 2000 },
    ).trim();
    cachedCpuModel = out.length > 0 ? out.slice(0, 200) : "";
    return cachedCpuModel || undefined;
  } catch {
    cachedCpuModel = "";
    return undefined;
  }
}

export function collectHostRuntimeInfo(): HostRuntimeInfo {
  const cpuModel = readCpuModelSync();
  return {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    nodeVersion: process.version,
    ...(cpuModel ? { cpuModel } : {}),
  };
}
