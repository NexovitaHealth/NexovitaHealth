# Email with Resend

Nexovita uses the **Resend Node SDK** (`resend` package) — not SMTP. A single API key is all that's needed.

## 1. Resend dashboard

1. Sign up at [resend.com](https://resend.com).
2. **API Keys** → Create key → copy `re_…`.
3. **Domains** → Add your domain (e.g. `nexovitahealth.com`).
4. Add the DNS records Resend shows in **Cloudflare** (MX, TXT/SPF, TXT/DKIM). Set them to **DNS only** (not proxied).
5. Wait until the domain status is **Verified**.

`EMAIL_FROM` must use the verified domain, e.g. `Nexovita Health <no-reply@nexovitahealth.com>`.

## 2. Local development (`.env.local`)

```env
RESEND_API_KEY="re_your_api_key"
EMAIL_FROM="Nexovita Health <no-reply@nexovitahealth.com>"
```

If `RESEND_API_KEY` is unset, email calls are skipped with a console warning — no crash.

## 3. Production (Secret Manager)

Run in **Cloud Shell** after `export PROJECT_ID=your-gcp-project-id`:

```bash
# Create secrets (first time)
echo -n 're_your_api_key' | gcloud secrets create nexovita-resend-api-key --project=$PROJECT_ID --data-file=-
echo -n 'Nexovita Health <no-reply@nexovitahealth.com>' | gcloud secrets create nexovita-email-from --project=$PROJECT_ID --data-file=-

# Grant Cloud Run runtime SA access
gcloud secrets add-iam-policy-binding nexovita-resend-api-key \
  --member="serviceAccount:nexovita-runtime@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

To rotate the API key later:

```bash
echo -n 're_new_key' | gcloud secrets versions add nexovita-resend-api-key --project=$PROJECT_ID --data-file=-
```

Then redeploy (push to `main`) so Cloud Run picks up the new version.

## 4. Verify

1. Deploy succeeds and `/api/health` returns `{"status":"ok"}`.
2. Trigger **Forgot password** or a **Team invite**.
3. Check **Resend → Logs** for delivery status.
4. If mail is skipped, check Cloud Run logs for `[Email] RESEND_API_KEY is not set`.
