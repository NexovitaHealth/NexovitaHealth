# Security

## Reporting a vulnerability

If you discover a security issue in Nexovita Health, please report it responsibly:

1. **Do not** open a public GitHub issue for exploitable vulnerabilities.
2. Email the maintainers with a description, impact, and reproduction steps.
3. Allow reasonable time for remediation before public disclosure.

## Supported versions

| Version | Supported |
| ------- | --------- |
| `main`  | Yes       |

## Security practices (production)

- Secrets live in **GCP Secret Manager** and **GitHub Actions secrets** — never in git.
- Cloud Run uses dedicated service accounts (`nexovita-runtime`, `nexovita-migrate`) with per-secret IAM.
- Deploy uses **Workload Identity Federation** (no long-lived GCP keys in CI).
- Cloud Run images are tagged with immutable **`BUILD_ID`** only.
- Cron endpoints require `Authorization: Bearer <CRON_SECRET>`.
- Staff APIs use session auth and org-scoped permission checks (`withOrgAccess`).
