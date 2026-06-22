#!/usr/bin/env bash
# Push OCI / deploy secrets to GitHub Actions from local files (never from CLI args).
#
# Setup:
#   cp -r infra/oci/secrets.example infra/oci/secrets
#   # edit infra/oci/secrets/github-secrets.env
#   # paste OCIR token into infra/oci/secrets/ocir-auth-token
#
# Run:
#   ./scripts/cloud-deploy/sync-github-secrets.sh
#   ./scripts/cloud-deploy/sync-github-secrets.sh --secrets-file path/to/github-secrets.env
#
# Reads OCI provider values from infra/oci/terraform.tfvars (OCIDs, region, admin_cidr).
# Reads deploy paths from infra/oci/secrets/github-secrets.env.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TFVARS="${REPO_ROOT}/infra/oci/terraform.tfvars"
SECRETS_FILE="${REPO_ROOT}/infra/oci/secrets/github-secrets.env"

usage() {
  cat <<EOF
Usage: $0 [--secrets-file PATH]

Loads secrets from files only (no tokens on the command line):
  - infra/oci/terraform.tfvars          OCI API OCIDs, region, SSH public key
  - infra/oci/secrets/github-secrets.env  SSH key path, OCIR namespace/username
  - file at OCIR_AUTH_TOKEN_FILE        raw OCIR auth token (one line)

Setup: cp -r infra/oci/secrets.example infra/oci/secrets
Guide: docs/developer/cloud-deploy-mvp/github-actions-setup.md
EOF
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --secrets-file) SECRETS_FILE="$2"; shift 2 ;;
    --ssh-private-key|--ocir-namespace|--ocir-username|--ocir-auth-token)
      echo "Error: $1 is no longer supported — use infra/oci/secrets/github-secrets.env"
      echo "See docs/developer/cloud-deploy-mvp/github-actions-setup.md"
      exit 1
      ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1"; usage ;;
  esac
done

expand_path() {
  local p="$1"
  case "$p" in
    "~/"*) printf '%s' "${HOME}/${p#~/}" ;;
    "~") printf '%s' "$HOME" ;;
    *) printf '%s' "$p" ;;
  esac
}

load_env_file() {
  local file="$1"
  local line key val
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [ -n "$line" ] || continue
    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${line#*=}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    val="${val#\"}"; val="${val%\"}"
    val="${val#\'}"; val="${val%\'}"
    export "$key=$val"
  done < "$file"
}

read_tfvar() {
  local key="$1"
  grep -E "^[[:space:]]*${key}[[:space:]]*=" "$TFVARS" | head -1 | sed -E 's/^[^=]+=[[:space:]]*"([^"]*)".*/\1/'
}

require_file() {
  local path="$1"
  local hint="$2"
  [ -f "$path" ] || { echo "Missing: $path"; echo "$hint"; exit 1; }
}

require_file "$TFVARS" "Create from terraform.tfvars.example after tofu apply setup."
require_file "$SECRETS_FILE" \
  "Copy infra/oci/secrets.example → infra/oci/secrets and edit github-secrets.env."

load_env_file "$SECRETS_FILE"

SSH_KEY="$(expand_path "${SSH_PRIVATE_KEY_PATH:-}")"
[ -n "$SSH_KEY" ] || { echo "Set SSH_PRIVATE_KEY_PATH in $SECRETS_FILE"; exit 1; }
require_file "$SSH_KEY" "SSH key must match ssh_public_key in terraform.tfvars (~/.ssh/oci_key)."

TENANCY_OCID="$(read_tfvar tenancy_ocid)"
USER_OCID="$(read_tfvar user_ocid)"
FINGERPRINT="$(read_tfvar api_key_fingerprint)"
PRIVATE_KEY_PATH="$(expand_path "$(read_tfvar private_key_path)")"
REGION="$(read_tfvar region)"
COMPARTMENT_OCID="$(read_tfvar compartment_ocid)"
ADMIN_CIDR="$(read_tfvar admin_cidr)"
SSH_PUBLIC_KEY="$(read_tfvar ssh_public_key)"
DEPLOY_HOST="$(cd "${REPO_ROOT}/infra/oci" && tofu output -raw instance_public_ip 2>/dev/null || true)"

require_file "$PRIVATE_KEY_PATH" "Set private_key_path in terraform.tfvars to your OCI API PEM."

OCIR_AUTH_TOKEN=""
if [ -n "${OCIR_AUTH_TOKEN_FILE:-}" ]; then
  TOKEN_PATH="$(expand_path "$OCIR_AUTH_TOKEN_FILE")"
  require_file "$TOKEN_PATH" "Paste OCIR auth token into this file (one line). See github-actions-setup.md."
  OCIR_AUTH_TOKEN="$(tr -d '[:space:]' < "$TOKEN_PATH")"
  [[ "$OCIR_AUTH_TOKEN" == *PLACEHOLDER* ]] && {
    echo "Replace placeholder token in $TOKEN_PATH before syncing."
    exit 1
  }
fi

echo "Setting GitHub repository secrets (repo: $(gh repo view --json nameWithOwner -q .nameWithOwner))"

gh secret set OCI_TENANCY_OCID --body "$TENANCY_OCID"
gh secret set OCI_USER_OCID --body "$USER_OCID"
gh secret set OCI_FINGERPRINT --body "$FINGERPRINT"
gh secret set OCI_PRIVATE_KEY < "$PRIVATE_KEY_PATH"
gh secret set OCI_REGION --body "$REGION"
gh secret set OCI_COMPARTMENT_OCID --body "$COMPARTMENT_OCID"
gh secret set OCI_ADMIN_CIDR --body "$ADMIN_CIDR"
gh secret set OCI_SSH_PUBLIC_KEY --body "$SSH_PUBLIC_KEY"
gh secret set OCI_SSH_PRIVATE_KEY < "$SSH_KEY"

if [ -n "$DEPLOY_HOST" ]; then
  gh secret set OCI_DEPLOY_HOST --body "$DEPLOY_HOST"
  echo "OCI_DEPLOY_HOST = $DEPLOY_HOST"
else
  echo "WARN: tofu output instance_public_ip unavailable — set OCI_DEPLOY_HOST manually"
fi

if [ -n "${OCIR_NAMESPACE:-}" ] && [ -n "$OCIR_AUTH_TOKEN" ]; then
  if [ -n "${OCIR_USERNAME:-}" ]; then
    USER_NS="${OCIR_USERNAME%%/*}"
    if [ "$USER_NS" != "$OCIR_NAMESPACE" ]; then
      echo "Error: OCIR_USERNAME must start with OCIR_NAMESPACE ($OCIR_NAMESPACE), got prefix '$USER_NS'" >&2
      echo "  Use <object-storage-namespace>/<oci-email>, not <tenancy-name>/<email>" >&2
      exit 1
    fi
  fi
  gh secret set OCIR_NAMESPACE --body "$OCIR_NAMESPACE"
  gh secret set OCIR_AUTH_TOKEN --body "$OCIR_AUTH_TOKEN"
  if [ -n "${OCIR_USERNAME:-}" ]; then
    gh secret set OCIR_USERNAME --body "$OCIR_USERNAME"
  else
    echo "WARN: set OCIR_USERNAME in $SECRETS_FILE (<namespace>/<oci-email>)"
  fi
else
  echo "Skipping OCIR secrets — set OCIR_NAMESPACE + OCIR_AUTH_TOKEN_FILE in $SECRETS_FILE"
fi

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
if ! gh api "repos/${REPO}/environments/production" &>/dev/null; then
  gh api --method PUT "repos/${REPO}/environments/production" --input - <<'EOF'
{}
EOF
  echo "Created GitHub environment: production"
fi

echo ""
echo "Done. Expected secrets:"
echo "  OCI_TENANCY_OCID OCI_USER_OCID OCI_FINGERPRINT OCI_PRIVATE_KEY OCI_REGION"
echo "  OCI_COMPARTMENT_OCID OCI_ADMIN_CIDR OCI_SSH_PUBLIC_KEY OCI_SSH_PRIVATE_KEY OCI_DEPLOY_HOST"
echo "  OCIR_NAMESPACE OCIR_USERNAME OCIR_AUTH_TOKEN  (when OCIR block is configured)"
echo ""
echo "Verify names only: gh secret list"
