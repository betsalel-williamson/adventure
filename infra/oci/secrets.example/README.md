# Local GitHub / OCIR secrets (example)

Copy to `infra/oci/secrets/` (gitignored):

```bash
cp -r infra/oci/secrets.example infra/oci/secrets
chmod 600 infra/oci/secrets/ocir-auth-token   # after you create it from the example
```

Fill in files, then sync to GitHub Actions:

```bash
./scripts/cloud-deploy/sync-github-secrets.sh
```

Full setup (OCI Console steps, OCIR repo, auth token): [GitHub Actions setup](../../../docs/developer/cloud-deploy-mvp/github-actions-setup.md).
