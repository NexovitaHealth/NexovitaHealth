# GitHub CI/CD → Google Cloud Run

On merge to **`main`**: **CI** runs first; **Deploy** runs only after CI succeeds (or use manual **Deploy** workflow for emergencies).

**Before first push:** [deploy/PRE-PUSH.md](./PRE-PUSH.md)

## Architecture

```
push to main → GitHub Actions (CI) → gcloud builds submit → Cloud Build → Cloud Run
                     ↑
              Workload Identity Federation (no long-lived GCP keys in GitHub)
```

## Prerequisites (one-time GCP)

Complete these **before** the first GitHub deploy:

1. **APIs enabled** — see [deploy/README.md](./README.md)
2. **Artifact Registry** — `nexovita` in `africa-south1`
3. **Cloud SQL** — instance + database + user
4. **Secret Manager** — all ten `nexovita-*` secrets with real values (including SMTP)
5. **Runtime IAM** — `./deploy/setup-gcp-runtime.sh` (dedicated SAs, least-privilege secret access)
6. **`DATABASE_URL` format** (Cloud Run socket, no `:5432`):

   ```text
   postgresql://nexovita:PASSWORD@/nexovita?host=/cloudsql/PROJECT:africa-south1:INSTANCE
   ```

7. **Cloud Build service accounts IAM** — compute + cloudbuild SAs need Artifact Registry, Cloud Run, Cloud SQL roles + `serviceAccountUser` on runtime/migrate SAs (see [README](./README.md))

## Step 1 — Push code to GitHub

```bash
cd nexovita
git init   # if not already a repo
git remote add origin git@github.com:YOUR_ORG/nexovita.git
git add .
git commit -m "Add GitHub CI/CD deployment"
git push -u origin main
```

Do **not** commit `.env`, `.env.local`, or credentials.

## Step 2 — Workload Identity Federation

In **Cloud Shell** (or local `gcloud`), from the repo:

```bash
export GCP_PROJECT_ID=your-gcp-project-id
export GITHUB_ORG=YOUR_GITHUB_USER_OR_ORG
export GITHUB_REPO=nexovita

chmod +x deploy/setup-github-wif.sh
./deploy/setup-github-wif.sh
```

The script prints **Secrets** and **Variables** to add in GitHub.

## Step 3 — GitHub repository settings

**Settings → Secrets and variables → Actions**

### Secrets

| Name | Example |
|------|---------|
| `GCP_WIF_PROVIDER` | From `./deploy/setup-github-wif.sh` output |
| `GCP_DEPLOY_SA` | From `./deploy/setup-github-wif.sh` output |

### Variables

| Name | Example |
|------|---------|
| `GCP_PROJECT_ID` | `your-gcp-project-id` |
| `GCP_REGION` | `africa-south1` |
| `CLOUDSQL_INSTANCE` | `your-gcp-project-id:africa-south1:your-sql-instance` |
| `APP_URL` | `https://your-production-domain.com` |
| `S3_ENDPOINT` | `https://ACCOUNT_ID.r2.cloudflarestorage.com` |

### Variables (optional)

| Name | Default | When to set |
|------|---------|-------------|
| `SMTP_PORT` | `587` | TLS-on-connect providers (often `465`) |
| `SMTP_SECURE` | `false` | Set `true` for port `465` or providers that require implicit TLS |

## Step 4 — First deploy

Push to `main` or run manually:

**Actions → Deploy to Cloud Run → Run workflow**

Watch:

- **CI** workflow — lint + build on PRs and main
- **Deploy** workflow — Cloud Build pipeline

## Step 5 — Verify

```bash
gcloud run services describe nexovita \
  --region=africa-south1 \
  --format='value(status.url)'
```

Then map **Cloudflare DNS** to that service (see [README § Cloudflare](./README.md)).

## Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `.github/workflows/ci.yml` | PR + push to main | `prisma validate`, typecheck, lint, build, audit |
| `.github/workflows/deploy.yml` | after CI on main, manual | `gcloud builds submit` + post-deploy health check |

## Enterprise controls (built in)

| Control | Implementation |
|---------|----------------|
| No GCP keys in GitHub | Workload Identity Federation (`setup-github-wif.sh`) |
| Immutable releases | Cloud Run image tag = Cloud Build `BUILD_ID` only (no `:latest`) |
| Dedicated runtime SAs | `nexovita-runtime` (app) + `nexovita-migrate` (DB job only) |
| SMTP in production | Secret Manager → `SMTP_*` / `EMAIL_FROM` on Cloud Run |
| DB migrations before traffic | Cloud Run Job `nexovita-migrate` runs before deploy |
| Health checks | `GET /api/health` — startup probe + post-deploy `curl` |
| Readiness (optional) | `GET /api/health?check=db` |
| Security headers | `next.config.mjs` (HSTS, frame deny, nosniff, etc.) |
| Cron auth | Shared `assertCronSecret` — Bearer `CRON_SECRET` |
| Deploy gate | GitHub `environment: production` (enable required reviewers in repo settings) |
| Dependency hygiene | Dependabot weekly + `npm audit` in CI |

**Recommended in GitHub:** Settings → Environments → `production` → required reviewers + deployment branch = `main`.

## Starting over checklist

If you are resetting a broken manual deploy:

- [ ] Fix `nexovita-database-url` secret (socket URL, not placeholder)
- [ ] Create SMTP secrets + run `./deploy/setup-gcp-runtime.sh`
- [ ] Run `./deploy/setup-github-wif.sh`
- [ ] Add GitHub secrets/variables
- [ ] Confirm `cloudbuild.yaml` substitutions come from GitHub variables (not committed secrets)
- [ ] Push to `main` — no more `gcloud builds submit` from Cloud Shell for routine deploys
- [ ] Optional: delete old failed Cloud Run revisions in console

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| GitHub auth failed | Re-run WIF script; check repo name matches `GITHUB_ORG/GITHUB_REPO` |
| Cloud Build permission denied | Grant `github-deploy` SA `roles/cloudbuild.builds.editor` + `roles/storage.objectAdmin` |
| Deploy health check failed | Wait for revision ready; confirm `/api/health` returns `{"status":"ok"}` |
| Prisma migrate order error | If dev DB used old migration folder name `20260522120000_tier4_*`, align `_prisma_migrations` or reset dev DB |
| Migrate P1001 | Fix `DATABASE_URL` secret — [socket format](#prerequisites-one-time-gcp) |
| `prisma: not found` | Ensure latest `cloudbuild.yaml` uses `--command=node --args=node_modules/prisma/build/index.js,migrate,deploy` |
| Push to Artifact Registry denied | Grant compute + cloudbuild SAs `roles/artifactregistry.writer` |

## Manual deploy (fallback)

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_CLOUDSQL_INSTANCE=PROJECT:africa-south1:INSTANCE,_APP_URL=https://...,_S3_ENDPOINT=https://...,_SMTP_PORT=587,_SMTP_SECURE=false
```
