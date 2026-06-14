#!/usr/bin/env bash
# Fix WIF "rejected by the attribute condition" for GitHub Actions deploy.
#
# Usage (must match your real GitHub repo URL: github.com/ORG/REPO):
#   export GCP_PROJECT_ID=your-gcp-project-id
#   export GITHUB_ORG=NexovitaHealth
#   export GITHUB_REPO=NexovitaHealth
#   export GITHUB_ENVIRONMENT=production   # same as deploy.yml environment:
#   ./deploy/fix-github-wif.sh

set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GITHUB_ORG:?Set GITHUB_ORG}"
: "${GITHUB_REPO:?Set GITHUB_REPO}"
GITHUB_ENVIRONMENT="${GITHUB_ENVIRONMENT:-production}"

SA_ID="github-deploy"
SA_EMAIL="${SA_ID}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
POOL_ID="github-pool"
PROVIDER_ID="github-provider"
REPO_SLUG="${GITHUB_ORG}/${GITHUB_REPO}"
PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"

# Deploy workflow uses environment: production — token includes assertion.environment
ATTRIBUTE_CONDITION="assertion.repository=='${REPO_SLUG}'"
if [ -n "$GITHUB_ENVIRONMENT" ]; then
  ATTRIBUTE_CONDITION="${ATTRIBUTE_CONDITION} && assertion.environment=='${GITHUB_ENVIRONMENT}'"
fi

echo "Updating WIF provider attribute-condition:"
echo "  ${ATTRIBUTE_CONDITION}"
echo ""

gcloud iam workload-identity-pools providers update-oidc "$PROVIDER_ID" \
  --project="$GCP_PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref,attribute.environment=assertion.environment" \
  --attribute-condition="$ATTRIBUTE_CONDITION"

echo "Ensuring service account IAM bindings..."

# Repository-wide (workflow_dispatch / older tokens)
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$GCP_PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO_SLUG}" \
  >/dev/null

# GitHub Environment (deploy.yml uses environment: production)
if [ -n "$GITHUB_ENVIRONMENT" ]; then
  gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
    --project="$GCP_PROJECT_ID" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO_SLUG}/attribute.environment/${GITHUB_ENVIRONMENT}" \
    >/dev/null
fi

cat <<EOF

Done. Confirm GitHub repo slug is exactly: ${REPO_SLUG}
  https://github.com/${REPO_SLUG}

Secrets (unchanged unless you recreated the pool):
  GCP_WIF_PROVIDER = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}
  GCP_DEPLOY_SA      = ${SA_EMAIL}

Re-run: Actions → Deploy to Cloud Run
EOF
