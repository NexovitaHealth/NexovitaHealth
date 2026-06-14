#!/usr/bin/env bash
# Submit Cloud Build with required substitutions (Cloud Shell or local gcloud).
#
# Usage:
#   export GCP_PROJECT_ID=rich-compiler-497321-e6
#   export CLOUDSQL_INSTANCE=rich-compiler-497321-e6:africa-south1:database-dev
#   export APP_URL=https://nexovitahealth.com
#   export S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
#   ./deploy/cloudbuild-submit.sh

set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${CLOUDSQL_INSTANCE:?Set CLOUDSQL_INSTANCE (PROJECT:REGION:INSTANCE)}"
: "${APP_URL:?Set APP_URL (https://...)}"
: "${S3_ENDPOINT:?Set S3_ENDPOINT}"

REGION="${GCP_REGION:-africa-south1}"

echo "Project:   $GCP_PROJECT_ID"
echo "Region:    $REGION"
echo "Cloud SQL: $CLOUDSQL_INSTANCE"
echo "App URL:   $APP_URL"
echo ""

gcloud builds submit \
  --project="$GCP_PROJECT_ID" \
  --region="$REGION" \
  --config=cloudbuild.yaml \
  --substitutions="_CLOUDSQL_INSTANCE=${CLOUDSQL_INSTANCE},_APP_URL=${APP_URL},_S3_ENDPOINT=${S3_ENDPOINT},_REGION=${REGION}" \
  .
