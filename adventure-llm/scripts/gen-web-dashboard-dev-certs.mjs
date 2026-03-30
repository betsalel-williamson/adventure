#!/usr/bin/env node
/**
 * Generate self-signed TLS key + cert for local dashboard (localhost + 127.0.0.1 SAN).
 * Requires OpenSSL 1.1.1+ on PATH. Output: adventure-llm/.cache/tls/dev-{key,cert}.pem
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(scriptDir, "..");
const outDir = path.join(packageRoot, ".cache", "tls");
const keyOut = path.join(outDir, "dev-key.pem");
const certOut = path.join(outDir, "dev-cert.pem");

/** Printed whenever these dev certs are in use — including skip-regenerate runs. */
const browserSelfSignedHint =
  "Your browser will warn about the self-signed cert; proceed once or use mkcert for local trust.\n";

mkdirSync(outDir, { recursive: true });

if (existsSync(keyOut) && existsSync(certOut)) {
  process.stderr.write(
    `adventure-llm: TLS files already exist:\n  ${keyOut}\n  ${certOut}\n`,
  );
  process.stderr.write("Remove them first to regenerate.\n");
  process.stderr.write(browserSelfSignedHint);
  process.exit(0);
}

const subject = "/CN=localhost";
const san = "subjectAltName=DNS:localhost,IP:127.0.0.1";

const r = spawnSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    keyOut,
    "-out",
    certOut,
    "-days",
    "825",
    "-subj",
    subject,
    "-addext",
    san,
  ],
  { stdio: "inherit", encoding: "utf8" },
);

if (r.status !== 0) {
  process.stderr.write(
    "openssl failed. Install OpenSSL 1.1.1+ or use ADVENTURE_LLM_WEB_INSECURE_HTTP=1.\n",
  );
  process.exit(r.status ?? 1);
}

process.stderr.write(
  `adventure-llm: wrote dev TLS files:\n  ${keyOut}\n  ${certOut}\n`,
);
process.stderr.write(browserSelfSignedHint);
