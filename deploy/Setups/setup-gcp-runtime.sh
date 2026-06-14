#!/usr/bin/env bash
# One-time GCP setup: dedicated Cloud Run service accounts + Secret Manager IAM
#
# Usage:
#   export GCP_PROJECT_ID=your-gcp-project-id
#   ./deploy/setup-gcp-runtime.sh
#
# Prerequisite: create Secret Manager secrets (see deploy/README.md and deploy/RESEND.md).

set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"

RUNTIME_SA_ID="nexovita-runtime"
MIGRATE_SA_ID="nexovita-migrate"
RUNTIME_SA="${RUNTIME_SA_ID}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
MIGRATE_SA="${MIGRATE_SA_ID}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

RUNTIME_SECRETS=(
  nexovita-database-url
  nexovita-jwt-secret
  nexovita-cron-secret
  nexovita-storage-bucket
  nexovita-storage-key-id
  nexovita-storage-secret
  nexovita-resend-api-key
  nexovita-email-from
  nexovita-cloudflare-token
)

MIGRATE_SECRETS=(
  nexovita-database-url
)

echo "Project: $GCP_PROJECT_ID ($PROJECT_NUMBER)"

create_sa() {
  local id="$1"
  local display="$2"
  gcloud iam service-accounts describe "${id}@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
    --project="$GCP_PROJECT_ID" >/dev/null 2>&1 || \
    gcloud iam service-accounts create "$id" \
      --project="$GCP_PROJECT_ID" \
      --display-name="$display"
}

create_sa "$RUNTIME_SA_ID" "Nexovita Cloud Run (app + cron)"
create_sa "$MIGRATE_SA_ID" "Nexovita Cloud Run Job (migrations only)"

for ROLE in roles/cloudsql.client; do
  for SA in "$RUNTIME_SA" "$MIGRATE_SA"; do
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
      --member="serviceAccount:${SA}" \
      --role="$ROLE" >/dev/null
  done
done

bind_secret_accessor() {
  local sa="$1"
  shift
  local secrets=("$@")
  for secret in "${secrets[@]}"; do
    if ! gcloud secrets describe "$secret" --project="$GCP_PROJECT_ID" >/dev/null 2>&1; then
      echo "WARN: Secret $secret not found — create it, then re-run this script."
      continue
    fi
    gcloud secrets add-iam-policy-binding "$secret" \
      --project="$GCP_PROJECT_ID" \
      --member="serviceAccount:${sa}" \
      --role="roles/secretmanager.secretAccessor" >/dev/null
  done
}

bind_secret_accessor "$RUNTIME_SA" "${RUNTIME_SECRETS[@]}"
bind_secret_accessor "$MIGRATE_SA" "${MIGRATE_SECRETS[@]}"

for SA in "$RUNTIME_SA" "$MIGRATE_SA"; do
  for DEPLOYER in "$CLOUDBUILD_SA" "$COMPUTE_SA"; do
    gcloud iam service-accounts add-iam-policy-binding "$SA" \
      --project="$GCP_PROJECT_ID" \
      --member="serviceAccount:${DEPLOYER}" \
      --role="roles/iam.serviceAccountUser" >/dev/null
  done
done

cat <<EOF

================================================================================
Runtime service accounts configured
================================================================================

  App / cron:  ${RUNTIME_SA}
  Migrations:  ${MIGRATE_SA}

cloudbuild.yaml uses:
  _RUNTIME_SA=${RUNTIME_SA_ID}
  _MIGRATE_SA=${MIGRATE_SA_ID}

Re-run this script after adding new Secret Manager secrets.

================================================================================
EOF
