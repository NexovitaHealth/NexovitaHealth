#!/usr/bin/env bash
# One-time setup: GitHub Actions → GCP via Workload Identity Federation
#
# Usage:
#   export GCP_PROJECT_ID=your-gcp-project-id
#   export GITHUB_ORG=your-org-or-user
#   export GITHUB_REPO=nexovita
#   ./deploy/setup-github-wif.sh
#
# Then add the printed values to GitHub → Settings → Secrets and variables → Actions

set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GITHUB_ORG:?Set GITHUB_ORG (GitHub user or org)}"
: "${GITHUB_REPO:?Set GITHUB_REPO}"

SA_ID="github-deploy"
SA_EMAIL="${SA_ID}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
POOL_ID="github-pool"
PROVIDER_ID="github-provider"
PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"

echo "Project: $GCP_PROJECT_ID ($PROJECT_NUMBER)"
echo "GitHub:    $GITHUB_ORG/$GITHUB_REPO"

gcloud iam service-accounts describe "$SA_EMAIL" --project="$GCP_PROJECT_ID" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA_ID" \
    --project="$GCP_PROJECT_ID" \
    --display-name="GitHub Actions deploy"

gcloud services enable iamcredentials.googleapis.com cloudbuild.googleapis.com \
  --project="$GCP_PROJECT_ID"

gcloud iam workload-identity-pools describe "$POOL_ID" \
  --project="$GCP_PROJECT_ID" \
  --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --project="$GCP_PROJECT_ID" \
    --location=global \
    --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$GCP_PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --project="$GCP_PROJECT_ID" \
    --location=global \
    --workload-identity-pool="$POOL_ID" \
    --display-name="GitHub" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${GITHUB_ORG}/${GITHUB_REPO}'" \
    --issuer-uri="https://token.actions.githubusercontent.com"

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$GCP_PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}"

# Submits builds + uploads source; Cloud Build SA runs the pipeline (see deploy/README.md IAM).
for ROLE in \
  roles/cloudbuild.builds.editor \
  roles/storage.objectAdmin
do
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" >/dev/null
done

WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

cat <<EOF

================================================================================
Add these in GitHub → ${GITHUB_ORG}/${GITHUB_REPO} → Settings → Secrets and variables → Actions
================================================================================

Secrets:
  GCP_WIF_PROVIDER = ${WIF_PROVIDER}
  GCP_DEPLOY_SA    = ${SA_EMAIL}

Variables (Repository variables):
  GCP_PROJECT_ID   = ${GCP_PROJECT_ID}
  GCP_REGION       = africa-south1
  CLOUDSQL_INSTANCE = PROJECT_ID:africa-south1:INSTANCE_NAME
  APP_URL          = https://your-production-domain.com
  S3_ENDPOINT      = https://ACCOUNT_ID.r2.cloudflarestorage.com

Optional variables:
  SMTP_PORT        = 587
  SMTP_SECURE      = false

================================================================================
Also run: ./deploy/setup-gcp-runtime.sh
Grant Cloud Build + compute SAs: roles/run.admin, roles/artifactregistry.writer
(see deploy/README.md § Cloud Build service accounts).
================================================================================
EOF
