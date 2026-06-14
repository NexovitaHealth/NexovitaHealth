# GitHub CI/CD → Google Cloud Run

On merge to **`main`**: **CI** runs first; **Deploy** runs only after CI succeeds (or use manual **Deploy** workflow for emergencies).

## Architecture

```
push to main → GitHub Actions (CI) → gcloud builds submit → Cloud Build → Cloud Run
                     ↑
              Workload Identity Federation (no long-lived GCP keys in GitHub)
```

## What not to commit

- `.env`, `.env.local`
- `storage/uploads/`
- Real API keys or database passwords

## Prerequisites (one-time GCP setup, in order)

1. **Enable APIs** — see [deploy/README.md](./README.md)
2. **Artifact Registry** — `nexovita` repository in `africa-south1`
3. **Cloud SQL** — instance + `nexovita` database + `nexovita` user
4. **Secret Manager** — all secrets with real values (see [README §1](./README.md)):
   - `nexovita-database-url` (socket URL — see below)
   - `nexovita-jwt-secret`, `nexovita-cron-secret`
   - `nexovita-storage-bucket`, `nexovita-storage-key-id`, `nexovita-storage-secret`
   - `nexovita-resend-api-key`, `nexovita-email-from`
   - `nexovita-cloudflare-token`
5. **Runtime IAM** — `./deploy/setup-gcp-runtime.sh` (dedicated SAs, least-privilege secret access)
6. **Cloud Build SA IAM** — `./deploy/fix-cloudbuild-runner-iam.sh` (Artifact Registry, Cloud Run, Cloud SQL roles)
7. **Workload Identity Federation** — `./deploy/setup-github-wif.sh` → add printed values to GitHub

**`DATABASE_URL` format** (Cloud Run socket — no port number):
```
postgresql://nexovita:PASSWORD@/nexovita?host=/cloudsql/PROJECT:africa-south1:INSTANCE
```

## Step 1 — Push code to GitHub

```bash
git remote add origin git@github.com:YOUR_ORG/nexovita.git
git push -u origin main
```

## Step 2 — Workload Identity Federation

In **Cloud Shell**:

```bash
export GCP_PROJECT_ID=your-gcp-project-id
export GITHUB_ORG=YOUR_GITHUB_USER_OR_ORG
export GITHUB_REPO=nexovita

chmod +x deploy/setup-github-wif.sh
./deploy/setup-github-wif.sh
```

The script prints the **Secrets** and **Variables** to add in GitHub.

## Step 3 — GitHub repository settings

**Settings → Secrets and variables → Actions**

### Secrets

| Name | Source |
|------|--------|
| `GCP_WIF_PROVIDER` | Output of `setup-github-wif.sh` |
| `GCP_DEPLOY_SA` | Output of `setup-github-wif.sh` |
| `RESEND_API_KEY` | Resend dashboard → API Keys |

### Variables

| Name | Example |
|------|---------|
| `GCP_PROJECT_ID` | `rich-compiler-497321-e6` |
| `GCP_REGION` | `africa-south1` |
| `CLOUDSQL_INSTANCE` | `PROJECT:africa-south1:INSTANCE` |
| `APP_URL` | `https://nexovitahealth.com` |
| `S3_ENDPOINT` | `https://ACCOUNT_ID.r2.cloudflarestorage.com` |

### Branch protection

Settings → Branches → `main` → Require **CI** status check before merging.

## Step 4 — First deploy

Push to `main` or run manually:

**Actions → Deploy to Cloud Run → Run workflow**

Watch:

- **CI** — lint + typecheck + build on PRs and main
- **Deploy** — Cloud Build pipeline (build image → migrate → deploy)

## Step 5 — Post-deploy

```bash
# Verify Cloud Run URL
gcloud run services describe nexovita \
  --region=africa-south1 \
  --format='value(status.url)'
```

Then:

- Map **Cloudflare DNS** to the Cloud Run URL — see [README §4](./README.md)
- Create **Cloud Scheduler** jobs — `./deploy/setup-cloud-scheduler.sh`
- Smoke test: login, invite email, document upload

## Deploy flow

```
PR → CI (lint, typecheck, build)
merge to main → CI → Deploy (only if CI succeeded)
```

Manual **Deploy** workflow bypasses CI — use only for emergencies.

## Enterprise controls

| Control | Implementation |
|---------|----------------|
| No GCP keys in GitHub | Workload Identity Federation (`setup-github-wif.sh`) |
| Immutable releases | Cloud Run image tag = Cloud Build `BUILD_ID` (no `:latest`) |
| Dedicated runtime SAs | `nexovita-runtime` (app) + `nexovita-migrate` (DB job only) |
| Email in production | `RESEND_API_KEY` + `EMAIL_FROM` from Secret Manager |
| DB migrations before traffic | Cloud Run Job `nexovita-migrate` runs before deploy |
| Health checks | `GET /api/health` — startup probe + post-deploy `curl` |
| Cron auth | Bearer `CRON_SECRET` on all `/api/cron/*` routes |
| Deploy gate | GitHub `environment: production` (enable required reviewers in repo settings) |
| Dependency hygiene | Dependabot weekly + `npm audit` in CI |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| GitHub auth `rejected by attribute condition` | Run `./deploy/fix-github-wif.sh` with the exact `GITHUB_ORG`/`GITHUB_REPO` from your GitHub URL |
| `forbidden from accessing bucket …_cloudbuild` | Run `./deploy/fix-github-deploy-iam.sh` |
| Cloud Build permission denied | Run `./deploy/fix-cloudbuild-runner-iam.sh` + `./deploy/setup-gcp-runtime.sh` |
| Deploy health check failed | Confirm `/api/health` returns `{"status":"ok"}`; check Cloud Run logs |
| Migrate `P1001` (connection refused) | Fix `nexovita-database-url` secret — must be socket format, no `:5432` |
| `prisma: not found` in migrate job | Ensure `cloudbuild.yaml` uses `--command=node --args=node_modules/prisma/build/index.js,migrate,deploy` |
| Push to Artifact Registry denied | Grant cloudbuild + compute SAs `roles/artifactregistry.writer` |
| Email not delivered | Check `nexovita-resend-api-key` secret exists; grant `nexovita-runtime` accessor; redeploy |

## Manual deploy (fallback)

```bash
./deploy/cloudbuild-submit.sh
```

Or directly:

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_CLOUDSQL_INSTANCE=PROJECT:africa-south1:INSTANCE,_APP_URL=https://nexovitahealth.com,_S3_ENDPOINT=https://ACCOUNT.r2.cloudflarestorage.com
```
