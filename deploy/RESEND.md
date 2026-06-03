# Email with Resend

Nexovita sends mail over **SMTP** (nodemailer). No Resend SDK is required.

## 1. Resend dashboard

1. Sign up at [resend.com](https://resend.com).
2. **API Keys** → Create key → copy `re_…`.
3. **Domains** → Add `nexovitahealth.com` (or your app domain).
4. Add the DNS records Resend shows (in **Cloudflare**, same domain you use for the app).
5. Wait until the domain status is **Verified**.

`EMAIL_FROM` must use that domain, e.g. `Nexovita Health <no-reply@nexovitahealth.com>`.

For quick testing only, Resend allows `onboarding@resend.dev` as the from address (do not use in production).

## 2. Local development (`.env.local`)

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=re_your_api_key
EMAIL_FROM="Nexovita Health <no-reply@nexovitahealth.com>"
```

Or keep Mailhog for local dev and only use Resend in GCP.

## 3. Production (Secret Manager)

Run in **Cloud Shell** (or local `gcloud`) after `export PROJECT_ID=your-gcp-project-id`:

```bash
echo -n 'smtp.resend.com' | gcloud secrets create nexovita-smtp-host --project=$PROJECT_ID --data-file=- 2>/dev/null || \
  echo -n 'smtp.resend.com' | gcloud secrets versions add nexovita-smtp-host --project=$PROJECT_ID --data-file=-

echo -n 'resend' | gcloud secrets create nexovita-smtp-user --project=$PROJECT_ID --data-file=- 2>/dev/null || \
  echo -n 'resend' | gcloud secrets versions add nexovita-smtp-user --project=$PROJECT_ID --data-file=-

echo -n 're_your_api_key' | gcloud secrets create nexovita-smtp-pass --project=$PROJECT_ID --data-file=- 2>/dev/null || \
  echo -n 're_your_api_key' | gcloud secrets versions add nexovita-smtp-pass --project=$PROJECT_ID --data-file=-

echo -n 'Nexovita Health <no-reply@nexovitahealth.com>' | gcloud secrets create nexovita-email-from --project=$PROJECT_ID --data-file=- 2>/dev/null || \
  echo -n 'Nexovita Health <no-reply@nexovitahealth.com>' | gcloud secrets versions add nexovita-email-from --project=$PROJECT_ID --data-file=-
```

Then grant access and redeploy:

```bash
export GCP_PROJECT_ID=$PROJECT_ID
./deploy/setup-gcp-runtime.sh
```

Push to `main` (or run the Deploy workflow) so Cloud Run picks up the new secret versions.

## 4. GitHub variables (optional)

Defaults match Resend STARTTLS on port 587:

| Variable | Value |
|----------|--------|
| `SMTP_PORT` | `587` (default — omit) |
| `SMTP_SECURE` | `false` (default — omit) |

Only if you use SMTPS on port 465:

| Variable | Value |
|----------|--------|
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |

## 5. Verify

1. Deploy succeeds and `/api/health` is OK.
2. Trigger **Forgot password** or **Team invite**.
3. Check **Resend → Emails** for delivery logs.
4. If mail fails, check Cloud Run logs for `[Email]` or `SMTP not configured`.

## Resend SMTP reference

| Setting | Value |
|---------|--------|
| Host | `smtp.resend.com` |
| Port | `587` (STARTTLS) or `465` (SSL) |
| Username | `resend` |
| Password | Your API key (`re_…`) |
