# OpenTofu — OCI Always Free stack for Adventure MVP

Provisions a single public VM (VCN + subnet + security list + compute) for the [C1 container](../../../docs/developer/cloud-deploy-mvp/container.md).

**Operator docs:** [Infrastructure as code](../../../docs/developer/cloud-deploy-mvp/infrastructure-as-code.md) · [Manual OCI setup](../../../docs/developer/cloud-deploy-mvp/oracle-cloud-setup.md)

## Prerequisites

- **OpenTofu** ≥ 1.8 (or Terraform ≥ 1.5 with the same HCL)
- OCI API key for a deploy user ([create in console](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm))
- Compartment OCID (create `adventure-mvp` in console first, or use root compartment for lab)

### Install OpenTofu on macOS

```bash
brew install opentofu
tofu version
```

No Homebrew: [install script](https://opentofu.org/docs/intro/install/) or full steps in [Infrastructure as code — getting started](../../../docs/developer/cloud-deploy-mvp/infrastructure-as-code.md#getting-started--install-opentofu-macos).

## Quick start

```bash
cd infra/oci
cp terraform.tfvars.example terraform.tfvars   # edit OCIDs, admin_cidr, ssh_public_key
tofu init
tofu plan                                     # confirm shape + availability domain
tofu apply
```

### After a successful apply

```bash
tofu output availability_domain    # e.g. bvec:PHX-AD-2
tofu output instance_public_ip
tofu output ssh_command

# Cloud-init installs Docker (~2 min). Then deploy C1 via CI:
ssh ubuntu@<PUBLIC_IP> 'docker --version'

# Sync GitHub secrets, then Actions → oci-deploy (see github-actions-setup.md).
# Local files only: cp -r infra/oci/secrets.example infra/oci/secrets
```

One-time bootstrap before OCIR: [deploy-c1-to-vm.sh](../../../scripts/cloud-deploy/deploy-c1-to-vm.sh) (requires `ADVENTURE_ALLOW_LOCAL_DEPLOY=1`; uploads image tarball only).

## Proven configuration (`us-phoenix-1`)

| Setting | Value | Notes |
| --- | --- | --- |
| `shape` | `VM.Standard.E2.1.Micro` | Works when Ampere reports out of capacity |
| `auto_select_availability_domain` | `true` | Picked **PHX-AD-2** when AD-1 had no Micro quota |
| `region` | `us-phoenix-1` | Home region for the reference tenancy |

Use **A1 Flex** (2 OCPU / 12 GB) when capacity is available — faster for `docker build`.

## GitHub Actions

Workflow [`.github/workflows/oci-infra.yml`](../../.github/workflows/oci-infra.yml):

- **Pull requests** — `tofu plan` (requires secrets)
- **Manual `workflow_dispatch`** — `tofu apply` after review

Deploy workflow [`.github/workflows/oci-deploy.yml`](../../.github/workflows/oci-deploy.yml) pushes C1 to OCIR and restarts the container over SSH.

See [infrastructure-as-code.md](../../../docs/developer/cloud-deploy-mvp/infrastructure-as-code.md) for secrets list.

## Variables

| Variable | Description |
| --- | --- |
| `tenancy_ocid` | Tenancy OCID (also used for platform image lookup) |
| `compartment_ocid` | Compartment for VCN + instance |
| `region` | e.g. `us-phoenix-1` |
| `admin_cidr` | Your IP `/32` for SSH and C1 smoke ports |
| `ssh_public_key` | Public key for `ubuntu` user |
| `shape` | `VM.Standard.E2.1.Micro` (default example) or `VM.Standard.A1.Flex` |
| `flex_ocpus` / `flex_memory_gbs` | A1 Flex only |
| `auto_select_availability_domain` | `true` — query OCI limits and pick an AD with quota |
| `availability_domain_index` | Manual AD when auto is `false` |

## Troubleshooting

| Error | Fix |
| --- | --- |
| `Out of host capacity` (A1) | Switch to `VM.Standard.E2.1.Micro` or smaller flex; retry later |
| `404` + E2.Micro | Shape not in that AD — keep `auto_select_availability_domain = true`; subnet may move AD |
| SSH timeout | Update `admin_cidr` to current IP; re-`tofu apply` |
| `tofu plan` shows subnet replace | Expected when auto AD changes; brief downtime |

## State

Default: **local** `terraform.tfstate` (gitignored). For team use, configure an [OCI Object Storage backend](https://opentofu.org/docs/language/settings/backends/oci/) — see IaC doc.

## Destroy

```bash
tofu destroy
```

Removes the instance, subnet, VCN, and related resources created by this stack.
