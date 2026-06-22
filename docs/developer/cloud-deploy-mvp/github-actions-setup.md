# GitHub Actions — OCI setup

Configure repository secrets and run **oci-infra** / **oci-deploy** workflows after [OpenTofu apply](../../../infra/oci/README.md).

**Rule:** Never paste tokens or private keys on the command line. Use gitignored files under `infra/oci/secrets/` and run the sync script.

## Prerequisites

- `tofu apply` succeeded — `tofu output instance_public_ip` returns a public IP
- **`admin_cidr`** in `infra/oci/terraform.tfvars` matches your current IPv4 (`curl -4 ifconfig.me/32`)
- SSH key pair for the VM — public key in `terraform.tfvars`, private key at `~/.ssh/oci_key` (or your path)
- [GitHub CLI](https://cli.github.com/) authenticated: `gh auth status`

---

## 1. Create OCI credentials (Console)

Do these once. Values land in **local files only** — not in the repo.

### 1a. API signing key (OpenTofu + oci-infra)

Used by `terraform.tfvars` → GitHub `OCI_PRIVATE_KEY`.

1. OCI Console → **Profile (top right) → My profile → API keys**
2. **Add API key** → **Generate API key pair** → download the **private** PEM
3. Save PEM outside the repo, e.g. `~/.oci/oci_api_key.pem` (`chmod 600`)
4. Copy the **Configuration file preview** values into `infra/oci/terraform.tfvars`:
   - `tenancy_ocid`, `user_ocid`, `api_key_fingerprint`, `private_key_path`
   - Extended steps: [Infrastructure as code — one-time setup](./infrastructure-as-code.md#one-time-setup)

### 1b. SSH key (VM login + deploy)

Used by `terraform.tfvars` (`ssh_public_key`) and GitHub `OCI_SSH_PRIVATE_KEY`.

If you already applied infra with `~/.ssh/oci_key`:

```bash
ssh-keygen -lf ~/.ssh/oci_key.pub   # must match ssh_public_key in terraform.tfvars
```

To create a new deploy key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/oci_key -C "you@laptop"
# Put oci_key.pub content in terraform.tfvars → ssh_public_key, then tofu apply
```

### 1c. OCIR container repository (oci-deploy)

1. OCI Console → **Developer Services → Container registry**
2. **Create repository**
   - Name: **`adventure-cloud`**
   - Access: **Private** (recommended)
3. Note your **tenancy namespace**: **Profile → Tenancy → Object Storage namespace** (short string, e.g. `axxxxx`)

### 1d. OCIR auth token (not the API key)

Separate from the API signing key in §1a.

1. OCI Console → **Profile → My profile → Auth tokens**
2. **Generate token** — description e.g. `github-actions-ocir`
3. Copy the token **once** (shown only at creation) into a local file (next section)

---

## 2. Local secret files (gitignored)

From repo root:

```bash
cp -r infra/oci/secrets.example infra/oci/secrets
cp infra/oci/secrets.example/ocir-auth-token.example infra/oci/secrets/ocir-auth-token
chmod 600 infra/oci/secrets/ocir-auth-token
```

Edit **`infra/oci/secrets/github-secrets.env`** (paths and OCIR identifiers only):

```bash
SSH_PRIVATE_KEY_PATH=~/.ssh/oci_key
OCIR_NAMESPACE=your_tenancy_namespace
OCIR_USERNAME=your_tenancy_namespace/your@oci-login-email
OCIR_AUTH_TOKEN_FILE=infra/oci/secrets/ocir-auth-token
```

| Field | Where to find it |
| --- | --- |
| `SSH_PRIVATE_KEY_PATH` | Private key matching `ssh_public_key` in `terraform.tfvars` |
| `OCIR_NAMESPACE` | Profile → Tenancy → Object Storage namespace |
| `OCIR_USERNAME` | `<namespace>/<oci-account-email>` (same email you use to sign in) |
| `OCIR_AUTH_TOKEN_FILE` | Path to one-line token file (default above) |

Edit **`infra/oci/secrets/ocir-auth-token`** — replace the placeholder with the token from §1d (single line, no quotes).

Confirm git ignores your secrets:

```bash
git check-ignore -v infra/oci/secrets/github-secrets.env infra/oci/secrets/ocir-auth-token
# should list .gitignore rules
```

---

## 3. Sync to GitHub Actions

```bash
chmod +x scripts/cloud-deploy/sync-github-secrets.sh
./scripts/cloud-deploy/sync-github-secrets.sh
```

The script reads:

| Source | GitHub secrets set |
| --- | --- |
| `infra/oci/terraform.tfvars` | `OCI_TENANCY_OCID`, `OCI_USER_OCID`, `OCI_FINGERPRINT`, `OCI_PRIVATE_KEY`, `OCI_REGION`, `OCI_COMPARTMENT_OCID`, `OCI_ADMIN_CIDR`, `OCI_SSH_PUBLIC_KEY` |
| `tofu output instance_public_ip` | `OCI_DEPLOY_HOST` |
| `github-secrets.env` → SSH path | `OCI_SSH_PRIVATE_KEY` |
| `github-secrets.env` + token file | `OCIR_NAMESPACE`, `OCIR_USERNAME`, `OCIR_AUTH_TOKEN` |

Verify **names only** (values are hidden):

```bash
gh secret list
```

Expected:

| Secret | Workflow |
| --- | --- |
| `OCI_*` (tenancy, user, fingerprint, private key, region, compartment, admin_cidr, ssh keys, deploy host) | oci-infra, oci-deploy |
| `OCIR_*` | oci-deploy only |

Creates GitHub **environment** `production` (optional approval gate for apply/deploy).

Re-run the sync script whenever you rotate keys, change IP (`admin_cidr` + re-apply), or replace the OCIR token.

---

## 4. Deploy C1 (CI — default)

**All production deploys:** **Actions → oci-deploy** (build on GitHub, push OCIR, SSH `docker pull` on VM).

After §3 completes:

- **Actions → oci-deploy → Run workflow**

Image: `region.ocir.io/<namespace>/adventure-cloud:<git-sha>`

### Bootstrap only (one-time, before OCIR)

Gated local script — uploads a **docker image tarball only** (not the repo):

```bash
ADVENTURE_ALLOW_LOCAL_DEPLOY=1 ./scripts/cloud-deploy/deploy-c1-to-vm.sh
# reads SSH_PRIVATE_KEY_PATH from infra/oci/secrets/github-secrets.env if present
```

Smoke test:

```bash
HOST=$(cd infra/oci && tofu output -raw instance_public_ip)
./scripts/cloud-deploy/container-smoke.sh "http://${HOST}:8787" "http://${HOST}:8790"
```

---

## 5. Run GitHub workflows

### oci-infra

- **Pull request** touching `infra/oci/**` → `tofu plan`
- **Actions → oci-infra → Run workflow** → **apply=true** for `tofu apply`

### oci-deploy

- **Actions → oci-deploy → Run workflow**

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `Missing infra/oci/secrets/github-secrets.env` | `cp -r infra/oci/secrets.example infra/oci/secrets` and edit |
| `PLACEHOLDER` token error | Paste real token into `infra/oci/secrets/ocir-auth-token` |
| SSH `Permission denied (publickey)` | `SSH_PRIVATE_KEY_PATH` must match `ssh_public_key` in tfvars |
| `curl` / smoke timeout | Update `admin_cidr` in tfvars, `tofu apply`, re-sync secrets |
| oci-deploy OCIR login fail | Check `OCIR_USERNAME` = `<namespace>/<email>`; regenerate auth token file |
| Missing `OCI_SSH_PRIVATE_KEY` in Actions | Re-run `sync-github-secrets.sh` after fixing `github-secrets.env` |

## Related

- [Infrastructure as code](./infrastructure-as-code.md)
- [Container (C1)](./container.md)
- [`infra/oci/secrets.example/`](../../../infra/oci/secrets.example/README.md)
