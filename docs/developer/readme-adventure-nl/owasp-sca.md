# OWASP Dependency-Check

Install: `brew install dependency-check`

From repository root:

```sh
make dependency-check
```

Or from `adventure-nl/` after `npm install`:

```sh
npm run dependency-check
```

Reports: `adventure-nl/reports/dependency-check/` (HTML + JSON).

First run downloads NVD data and can take several minutes. Set **`NVD_API_KEY`** to avoid HTTP 429 rate limits, or use **`make dependency-check-quick`** / `npm run dependency-check:quick`.
