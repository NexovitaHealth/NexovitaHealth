# Operations Runbook

Procedures for common production tasks on Cloud Run + Cloud SQL.

---

## Adding a Platform Owner account

Platform owners have the `owner` UserRole and can access `/admin`. There is no UI to create them — you insert directly into the database and the user activates via Forgot Password.

### 1. Connect to Cloud SQL

From **Google Cloud Shell**:

```bash
# Find the instance name
gcloud sql instances list --project=YOUR_PROJECT_ID

# Connect (you'll be prompted for the nexovita user password)
gcloud sql connect INSTANCE_NAME --user=nexovita --database=nexovita --project=YOUR_PROJECT_ID
```

> Use `--user=nexovita` (not `postgres`). The `users` table is owned by `nexovita`.

### 2. Insert the user

```sql
INSERT INTO users (id, email, password_hash, full_name, role, email_verified, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'owner@example.com',
  '$2a$12$LockdAccountXXXXXXXXXXuGXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'Owner Full Name',
  'owner',
  true,
  now(),
  now()
);
```

The `password_hash` value above is a locked placeholder — it does not match any real password.

### 3. Verify

```sql
SELECT id, email, full_name, role, email_verified FROM users WHERE email = 'owner@example.com';
```

### 4. Activate the account

Go to `https://nexovitahealth.com/forgot-password`, enter the owner's email. They will receive a reset link to set their password. The account is immediately usable after the reset.

---

## Rotating the Resend API key

```bash
echo -n 're_new_key' | gcloud secrets versions add nexovita-resend-api-key \
  --project=YOUR_PROJECT_ID --data-file=-
```

Then push to `main` (or trigger the Deploy workflow) to redeploy with the new secret version.

---

## Running a database migration manually

If you need to apply migrations outside of a deploy:

```bash
# Trigger the migration Cloud Run Job
gcloud run jobs execute nexovita-migrate --region=africa-south1 --project=YOUR_PROJECT_ID --wait
```

Check job logs:

```bash
gcloud run jobs executions list --job=nexovita-migrate --region=africa-south1 --project=YOUR_PROJECT_ID
```

---

## Checking email delivery

1. Open **Resend → Logs** to see per-email delivery status.
2. Check Cloud Run logs for `[Email]` prefix to diagnose send failures.
3. If all emails are skipped, confirm `nexovita-resend-api-key` secret exists and `nexovita-runtime` SA has `roles/secretmanager.secretAccessor` on it.
