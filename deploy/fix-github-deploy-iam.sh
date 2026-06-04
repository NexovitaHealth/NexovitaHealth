#!/usr/bin/env bash
# Fix: gcloud builds submit forbidden on PROJECT_cloudbuild bucket (GitHub Actions deploy).
#
# Usage:
#   export GCP_PROJECT_ID=your-gcp-project-id
#   ./deploy/fix-github-deploy-iam.sh

set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"

SA_EMAIL="github-deploy@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
CLOUDBUILD_BUCKET="${GCP_PROJECT_ID}_cloudbuild"

echo "Project:     $GCP_PROJECT_ID"
echo "Deploy SA:   $SA_EMAIL"
echo "Bucket:      gs://${CLOUDBUILD_BUCKET}"
echo ""

gcloud services enable \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  serviceusage.googleapis.com \
  --project="$GCP_PROJECT_ID"

for ROLE in \
  roles/cloudbuild.builds.editor \
  roles/serviceusage.serviceUsageConsumer \
  roles/storage.objectAdmin
do
  echo "Granting ${ROLE}..."
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" >/dev/null
done

# Explicit bucket ACL (default Cloud Build staging bucket)
if gcloud storage buckets describe "gs://${CLOUDBUILD_BUCKET}" --project="$GCP_PROJECT_ID" >/dev/null 2>&1; then
  echo "Granting objectAdmin on gs://${CLOUDBUILD_BUCKET}..."
  gcloud storage buckets add-iam-policy-binding "gs://${CLOUDBUILD_BUCKET}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/storage.objectAdmin" \
    --project="$GCP_PROJECT_ID" >/dev/null
else
  echo "WARN: Bucket gs://${CLOUDBUILD_BUCKET} not found yet."
  echo "      It is created on first Cloud Build; re-run this script after one manual build if submit still fails."
fi

cat <<EOF

Done. Re-run GitHub Actions → Deploy to Cloud Run.

If it still fails, check org policies blocking storage or Cloud Build for ${SA_EMAIL}.
EOF
