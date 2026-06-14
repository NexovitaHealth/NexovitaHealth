# Deploy Nexovita on Google Cloud + Cloudflare

Run the Next.js app on **Cloud Run** (GCP) with **Cloud SQL** for PostgreSQL. Put **Cloudflare** in front for DNS, WAF, and TLS. Use **Cloudflare R2** or **GCS** for document uploads.

## Architecture

```
Browser → Cloudflare (DNS/WAF/CDN) → Cloud Run → Cloud SQL
                                   ↘ R2 or GCS (documents)
Cloud Scheduler → Cloud Run (/api/cron/*)
```

## 1. Google Cloud setup

### Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  cloudscheduler.googleapis.com
```

### Artifact Registry (Johannesburg)

GCP region `**africa-south1**` (Johannesburg). Use the same region for Cloud Run, Cloud SQL, and Scheduler so latency and egress stay local.

```bash
export REGION=africa-south1
gcloud artifacts repositories create nexovita \
  --repository-format=docker \
  --location=$REGION
```

### Cloud SQL (PostgreSQL 15+)

Create an instance in `**africa-south1**` (Johannesburg) and a database, then note the connection name:

`PROJECT_ID:REGION:INSTANCE_NAME`

**Socket connection string** (recommended on Cloud Run):

```env
DATABASE_URL="postgresql://nexovita:PASSWORD@/nexovita?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME"
```

### Secret Manager

Create secrets (values from `.env.example`). Use `gcloud secrets versions add` if a secret already exists.

```bash
export PROJECT_ID=your-gcp-project-id

# Core
echo -n 'postgresql://...' | gcloud secrets create nexovita-database-url --project=$PROJECT_ID --data-file=-
echo -n "$(openssl rand -base64 32)" | gcloud secrets create nexovita-jwt-secret --project=$PROJECT_ID --data-file=-
echo -n "$(openssl rand -base64 32)" | gcloud secrets create nexovita-cron-secret --project=$PROJECT_ID --data-file=-
echo -n 'your-bucket-name' | gcloud secrets create nexovita-storage-bucket --project=$PROJECT_ID --data-file=-
echo -n 'access-key-id' | gcloud secrets create nexovita-storage-key-id --project=$PROJECT_ID --data-file=-
echo -n 'secret-access-key' | gcloud secrets create nexovita-storage-secret --project=$PROJECT_ID --data-file=-

# Email — Resend native SDK (see deploy/RESEND.md)
echo -n 're_your_resend_api_key' | gcloud secrets create nexovita-resend-api-key --project=$PROJECT_ID --data-file=-
echo -n 'Nexovita Health <no-reply@nexovitahealth.com>' | gcloud secrets create nexovita-email-from --project=$PROJECT_ID --data-file=-
```

### Dedicated Cloud Run service accounts

Do **not** use the default compute service account in production. Run once:

```bash
export GCP_PROJECT_ID=your-gcp-project-id
chmod +x deploy/setup-gcp-runtime.sh
./deploy/setup-gcp-runtime.sh
```

This creates:


| Account              | Purpose                     | Secret access                                  |
| -------------------- | --------------------------- | ---------------------------------------------- |
| `nexovita-runtime@…` | Web service + cron handlers | All app secrets (DB, JWT, storage, SMTP, cron) |
| `nexovita-migrate@…` | `prisma migrate deploy` job | `nexovita-database-url` only                   |


Cloud Build / compute SAs receive `roles/iam.serviceAccountUser` on both accounts so deploy can attach them.

### Cloud Build service accounts

Cloud Build (and the legacy compute default SA used by some `gcloud run` deploy paths) need:

```bash
export PROJECT_ID=your-gcp-project-id
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

for SA in \
  "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
do
  for ROLE in \
    roles/run.admin \
    roles/artifactregistry.writer \
    roles/logging.logWriter
  do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member="serviceAccount:${SA}" \
      --role="$ROLE" >/dev/null
  done
done
```

Then run `./deploy/setup-gcp-runtime.sh` so those deployers can `actAs` `nexovita-runtime` and `nexovita-migrate`.

## 2. Object storage

### Option A — Cloudflare R2 (recommended with Cloudflare edge)

1. Create an R2 bucket in the Cloudflare dashboard.
2. Create R2 API tokens (S3-compatible).
3. Set on Cloud Run:

```env
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true
AWS_REGION=auto
AWS_ACCESS_KEY_ID=<R2 access key>
AWS_SECRET_ACCESS_KEY=<R2 secret>
S3_BUCKET=nexovita-uploads
```

### Option B — Google Cloud Storage (S3 interop)

1. Enable [HMAC keys](https://cloud.google.com/storage/docs/authentication/managing-hmackeys) for GCS.
2. Set on Cloud Run:

```env
STORAGE_PROVIDER=gcs
S3_ENDPOINT=https://storage.googleapis.com
S3_FORCE_PATH_STYLE=true
AWS_REGION=auto
AWS_ACCESS_KEY_ID=<GCS HMAC access id>
AWS_SECRET_ACCESS_KEY=<GCS HMAC secret>
S3_BUCKET=nexovita-uploads
```

Do **not** use `STORAGE_PROVIDER=local` on Cloud Run — the filesystem is ephemeral.

## 3. Build and deploy

**Recommended:** GitHub Actions CI/CD — see **[deploy/github-cicd.md](github-cicd.md)**.

Manual fallback from Cloud Shell:

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_CLOUDSQL_INSTANCE=PROJECT:africa-south1:INSTANCE,_APP_URL=https://app.example.com,_S3_ENDPOINT=https://ACCOUNT.r2.cloudflarestorage.com
```

The pipeline:

1. Builds the Docker image (immutable tag `$BUILD_ID`)
2. Runs `prisma migrate deploy` via Cloud Run Job (`nexovita-migrate` SA)
3. Deploys the web service to Cloud Run (`nexovita-runtime` SA, SMTP + storage secrets)

### Local Docker test

```bash
docker build -t nexovita .
docker run -p 8080:8080 --env-file .env.production nexovita
```

## 4. Cloudflare

1. Add your domain to Cloudflare.
2. Create a **CNAME** (proxied) pointing to the Cloud Run URL, or map a custom domain on Cloud Run and proxy through Cloudflare.
3. SSL/TLS mode: **Full (strict)**.
4. Cache rules:
  - **Cache**: `/_next/static/`*
  - **Bypass**: `/api/`*, authenticated app routes
5. Optional: rate limit `/api/auth/*`.

Set `NEXT_PUBLIC_APP_URL=https://app.yourdomain.com` on Cloud Run to match the public URL.

## 5. Cron jobs

Cron routes require `Authorization: Bearer $CRON_SECRET`.

```bash
chmod +x deploy/setup-cloud-scheduler.sh
export APP_URL=https://app.yourdomain.com
export CRON_SECRET=...
export GCP_PROJECT=...
./deploy/setup-cloud-scheduler.sh
```

## 6. Email (Resend)

Production uses the **Resend Node SDK** via Secret Manager (`nexovita-resend-api-key`, `nexovita-email-from`). Step-by-step: **[deploy/RESEND.md](RESEND.md)**.

Verify your domain in Resend, add the DNS records in Cloudflare (DNS only, not proxied), then test with Forgot Password after deploy.

## 7. First deploy checklist

- Cloud SQL instance running; `DATABASE_URL` secret set
- All Secret Manager entries created (`nexovita-database-url`, `nexovita-jwt-secret`, `nexovita-cron-secret`, storage secrets, `nexovita-resend-api-key`, `nexovita-email-from`, `nexovita-cloudflare-token`)
- `./deploy/setup-gcp-runtime.sh` completed
- R2 or GCS bucket + credentials configured
- `cloudbuild.yaml` substitutions updated
- `gcloud builds submit` succeeded
- Cloudflare DNS proxied to Cloud Run
- `NEXT_PUBLIC_APP_URL` matches public URL
- Cloud Scheduler jobs created
- Smoke test: login, upload document, billing page loads

## Troubleshooting


| Issue                               | Fix                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| Migrations fail                     | Check Cloud SQL connection name on Job + `--set-cloudsql-instances`               |
| Upload 500                          | Verify `S3_ENDPOINT`, bucket name, and HMAC/R2 keys                               |
| Session lost on login               | Ensure `NEXT_PUBLIC_APP_URL` uses HTTPS; Cloudflare SSL is Full (strict)          |
| Cron 401                            | `CRON_SECRET` must match Scheduler `Authorization` header                         |
| Email skipped | Create `nexovita-resend-api-key` secret; grant `nexovita-runtime` accessor; redeploy. Check Cloud Run logs for `RESEND_API_KEY is not set`. |
| Permission denied on deploy SA      | Run `setup-gcp-runtime.sh`; ensure Cloud Build SA can `actAs` runtime/migrate SAs |


