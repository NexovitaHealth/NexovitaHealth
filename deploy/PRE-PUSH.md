# Pre-push checklist (GitHub + GCP)

Use this before the first push to GitHub and before relying on automated deploy.

## Do not commit

- `.env`, `.env.local`
- `storage/uploads/`
- `Feature Audit List.md`, `Guidelines.md`
- Real API keys or database passwords

## Do commit

- `.github/workflows/ci.yml`, `deploy.yml`
- `.github/dependabot.yml`
- `cloudbuild.yaml`, `Dockerfile`, `.dockerignore`, `.gcloudignore`
- `deploy/*` scripts and docs
- `.env.example`, `SECURITY.md`
- `prisma/migrations/` (including rename `20260522120100_tier4_*`)

## GCP one-time (order matters)

1. Enable APIs — [README §1](./README.md)
2. Artifact Registry repo `nexovita` in `africa-south1`
3. Cloud SQL + socket `DATABASE_URL` in `nexovita-database-url`
4. All **10** Secret Manager secrets (core + SMTP)
5. `./deploy/setup-gcp-runtime.sh`
6. Cloud Build / compute SA IAM — [README § Cloud Build](./README.md)
7. `./deploy/setup-github-wif.sh` → GitHub secrets/variables

## GitHub repository

| Type | Required |
|------|----------|
| Secrets | `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA` |
| Variables | `GCP_PROJECT_ID`, `GCP_REGION`, `CLOUDSQL_INSTANCE`, `APP_URL` (https), `S3_ENDPOINT` |
| Optional | `SMTP_PORT`, `SMTP_SECURE` |
| Environment | `production` (optional reviewers) |
| Branch protection | Require **CI** on `main` before merge |

## Deploy flow (after push)

```
PR → CI (lint, typecheck, build)
merge to main → CI → Deploy (only if CI succeeded)
```

Manual **Deploy** workflow skips CI — use only for emergencies.

## First deploy blockers (from prior sessions)

| Blocker | Fix |
|---------|-----|
| `nexovita-database-url` placeholder | Socket URL: `postgresql://USER:PASS@/nexovita?host=/cloudsql/PROJECT:africa-south1:INSTANCE` |
| Missing SMTP secrets | Create four `nexovita-smtp-*` / `nexovita-email-from` |
| Runtime SA not set up | `./deploy/setup-gcp-runtime.sh` |
| Migrate `prisma: not found` | Fixed in `cloudbuild.yaml` (node + prisma path) |

## Post-deploy

- `./deploy/setup-cloud-scheduler.sh` with production `APP_URL` + `CRON_SECRET`
- Cloudflare DNS → Cloud Run
- Smoke: login, invite email (Resend — [RESEND.md](./RESEND.md)), document upload
