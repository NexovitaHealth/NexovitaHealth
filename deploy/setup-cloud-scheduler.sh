#!/usr/bin/env bash
# Create Cloud Scheduler jobs for Nexovita cron routes.
# Usage:
#   export APP_URL=https://app.yourdomain.com
#   export CRON_SECRET=your-secret
#   export GCP_PROJECT=your-project
#   export GCP_REGION=africa-south1
#   ./deploy/setup-cloud-scheduler.sh

set -euo pipefail

: "${APP_URL:?Set APP_URL}"
: "${CRON_SECRET:?Set CRON_SECRET}"
: "${GCP_PROJECT:?Set GCP_PROJECT}"
: "${GCP_REGION:=africa-south1}"

create_job() {
  local name="$1"
  local path="$2"
  local schedule="$3"

  gcloud scheduler jobs create http "$name" \
    --project="$GCP_PROJECT" \
    --location="$GCP_REGION" \
    --schedule="$schedule" \
    --uri="${APP_URL}${path}" \
    --http-method=POST \
    --headers="Authorization=Bearer ${CRON_SECRET}" \
    --attempt-deadline=300s \
    --time-zone="Africa/Johannesburg" \
    2>/dev/null || \
  gcloud scheduler jobs update http "$name" \
    --project="$GCP_PROJECT" \
    --location="$GCP_REGION" \
    --schedule="$schedule" \
    --uri="${APP_URL}${path}" \
    --http-method=POST \
    --headers="Authorization=Bearer ${CRON_SECRET}" \
    --attempt-deadline=300s \
    --time-zone="Africa/Johannesburg"
}

create_job "nexovita-missed-visits" "/api/cron/missed-visits" "*/15 * * * *"
create_job "nexovita-email-retries" "/api/cron/email-retries" "*/10 * * * *"

echo "Scheduler jobs configured for ${APP_URL}"
