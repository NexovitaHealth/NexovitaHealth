#!/usr/bin/env bash
# IAM for Cloud Build + compute SAs (run migrate job, deploy Cloud Run, push images).
#
# Usage:
#   export GCP_PROJECT_ID=your-gcp-project-id
#   ./deploy/fix-cloudbuild-runner-iam.sh
#
# Run after ./deploy/setup-gcp-runtime.sh

set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"

PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
RUNTIME_SA="nexovita-runtime@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
MIGRATE_SA="nexovita-migrate@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

echo "Project: $GCP_PROJECT_ID ($PROJECT_NUMBER)"
echo ""

for SA in "$CLOUDBUILD_SA" "$COMPUTE_SA"; do
  echo "Granting roles to $SA ..."
  for ROLE in \
    roles/run.admin \
    roles/artifactregistry.writer \
    roles/iam.serviceAccountUser \
    roles/logging.logWriter
  do
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
      --member="serviceAccount:${SA}" \
      --role="$ROLE" >/dev/null
  done
done

for TARGET in "$RUNTIME_SA" "$MIGRATE_SA"; do
  for DEPLOYER in "$CLOUDBUILD_SA" "$COMPUTE_SA"; do
    gcloud iam service-accounts add-iam-policy-binding "$TARGET" \
      --project="$GCP_PROJECT_ID" \
      --member="serviceAccount:${DEPLOYER}" \
      --role="roles/iam.serviceAccountUser" >/dev/null
  done
done

echo ""
echo "Done. Re-run: ./deploy/cloudbuild-submit.sh"
