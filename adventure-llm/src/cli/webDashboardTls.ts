import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type https from "node:https";

const DEFAULT_KEY_REL = [".cache", "tls", "dev-key.pem"] as const;
const DEFAULT_CERT_REL = [".cache", "tls", "dev-cert.pem"] as const;

export type ResolvedWebDashboardTls = {
  readonly key: Buffer;
  readonly cert: Buffer;
};

function readTlsFile(p: string): Buffer {
  return readFileSync(p);
}

/**
 * Resolve TLS material for the web dashboard.
 * Returns null if caller should use plain HTTP (explicit insecure mode only).
 */
export function resolveWebDashboardTls(
  packageRoot: string,
): ResolvedWebDashboardTls | null {
  const keyEnv = process.env.ADVENTURE_LLM_WEB_TLS_KEY?.trim();
  const certEnv = process.env.ADVENTURE_LLM_WEB_TLS_CERT?.trim();
  const keyPath =
    keyEnv && keyEnv.length > 0
      ? path.resolve(keyEnv)
      : path.join(packageRoot, ...DEFAULT_KEY_REL);
  const certPath =
    certEnv && certEnv.length > 0
      ? path.resolve(certEnv)
      : path.join(packageRoot, ...DEFAULT_CERT_REL);
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    return null;
  }
  return {
    key: readTlsFile(keyPath),
    cert: readTlsFile(certPath),
  };
}

export function isWebDashboardInsecureHttp(): boolean {
  const v = process.env.ADVENTURE_LLM_WEB_INSECURE_HTTP?.trim();
  return v === "1" || v?.toLowerCase() === "true";
}

export function httpsServerOptionsFromTls(
  tls: ResolvedWebDashboardTls,
): https.ServerOptions {
  return { key: tls.key, cert: tls.cert };
}
