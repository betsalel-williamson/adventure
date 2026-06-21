# Changesets

We use [Changesets](https://github.com/changesets/changesets) to track semver
bumps and changelogs across TypeScript packages.

When your PR includes a user-facing or release-worthy change, add a changeset:

```bash
npm run changeset
```

Choose the affected package(s) and bump type (patch / minor / major). Changesets
are merged with your PR; version bumps land in a follow-up **Version Packages**
PR via CI.

Not every PR needs a changeset (docs-only, refactors, tests, CI-only).

See [CONTRIBUTING.md](../CONTRIBUTING.md#versioning-changesets).
