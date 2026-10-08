#!/bin/bash
# =============================================================================
# HubSpot User Deprovisioning Job — Cloud Scheduler Setup
#
# This script creates a Cloud Scheduler job that triggers the
# HubSpot User Deprovisioning Cloud Run Job at 2:00 AM Eastern Time daily.
#
# Prerequisites:
#   - The Cloud Run Job must already be deployed (via CloudBuild)
#   - A service account with Cloud Run Invoker permissions
#
# Usage:
#   ./setup_scheduler.sh <PROJECT_ID> <REGION> <SERVICE_ACCOUNT_EMAIL>
#
# Example:
#   ./setup_scheduler.sh my-project us-central1 scheduler-sa@my-project.iam.gserviceaccount.com
# =============================================================================

set -euo pipefail

# --- Configuration ---
SCHEDULER_JOB_NAME="hubspot-user-deprovisioning-nightly"
CLOUD_RUN_JOB_NAME="hubspot-user-deprovisioning-job"

# 2:00 AM Eastern Time (America/New_York handles EST/EDT automatically)
CRON_SCHEDULE="0 2 * * *"
TIMEZONE="America/New_York"

# --- Parse Arguments ---
if [ $# -lt 3 ]; then
    echo "Usage: $0 <PROJECT_ID> <REGION> <SERVICE_ACCOUNT_EMAIL>"
    echo ""
    echo "Arguments:"
    echo "  PROJECT_ID              Google Cloud project ID"
    echo "  REGION                  Cloud Run region (e.g., us-central1)"
    echo "  SERVICE_ACCOUNT_EMAIL   Service account with Cloud Run Invoker role"
    exit 1
fi

PROJECT_ID="$1"
REGION="$2"
SERVICE_ACCOUNT_EMAIL="$3"

echo "================================================="
echo " HubSpot User Deprovisioning — Scheduler Setup"
echo "================================================="
echo ""
echo "Project:          ${PROJECT_ID}"
echo "Region:           ${REGION}"
echo "Cloud Run Job:    ${CLOUD_RUN_JOB_NAME}"
echo "Scheduler Job:    ${SCHEDULER_JOB_NAME}"
echo "Schedule:         ${CRON_SCHEDULE} (${TIMEZONE})"
echo "Service Account:  ${SERVICE_ACCOUNT_EMAIL}"
echo ""

# --- Step 1: Verify the Cloud Run Job exists ---
echo "1. Verifying Cloud Run Job exists..."
if ! gcloud run jobs describe "${CLOUD_RUN_JOB_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --format="value(name)" 2>/dev/null; then
    echo "ERROR: Cloud Run Job '${CLOUD_RUN_JOB_NAME}' not found in ${REGION}."
    echo "Please deploy the job first using CloudBuild."
    exit 1
fi
echo "   ✓ Cloud Run Job found."
echo ""

# --- Step 2: Grant the service account permission to invoke the Cloud Run Job ---
echo "2. Granting Cloud Run Invoker role to service account..."
gcloud run jobs add-iam-policy-binding "${CLOUD_RUN_JOB_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/run.invoker" \
    --quiet
echo "   ✓ IAM binding configured."
echo ""

# --- Step 3: Create or update the Cloud Scheduler job ---
echo "3. Creating Cloud Scheduler job..."

# Build the Cloud Run Job URI
CLOUD_RUN_JOB_URI="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${CLOUD_RUN_JOB_NAME}:run"

# Check if scheduler job already exists
if gcloud scheduler jobs describe "${SCHEDULER_JOB_NAME}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}" 2>/dev/null; then
    echo "   Scheduler job already exists. Updating..."
    gcloud scheduler jobs update http "${SCHEDULER_JOB_NAME}" \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --schedule="${CRON_SCHEDULE}" \
        --time-zone="${TIMEZONE}" \
        --uri="${CLOUD_RUN_JOB_URI}" \
        --http-method="POST" \
        --oauth-service-account-email="${SERVICE_ACCOUNT_EMAIL}" \
        --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" \
        --quiet
else
    echo "   Creating new scheduler job..."
    gcloud scheduler jobs create http "${SCHEDULER_JOB_NAME}" \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --schedule="${CRON_SCHEDULE}" \
        --time-zone="${TIMEZONE}" \
        --uri="${CLOUD_RUN_JOB_URI}" \
        --http-method="POST" \
        --oauth-service-account-email="${SERVICE_ACCOUNT_EMAIL}" \
        --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" \
        --quiet
fi
echo "   ✓ Cloud Scheduler job configured."
echo ""

# --- Done ---
echo "================================================="
echo " Setup Complete!"
echo "================================================="
echo ""
echo "The deprovisioning job will run daily at 2:00 AM ET."
echo ""
echo "Useful commands:"
echo "  # Manually trigger the job:"
echo "  gcloud run jobs execute ${CLOUD_RUN_JOB_NAME} --region=${REGION} --project=${PROJECT_ID}"
echo ""
echo "  # View job logs:"
echo "  gcloud logging read 'resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"${CLOUD_RUN_JOB_NAME}\"' --project=${PROJECT_ID} --limit=50"
echo ""
echo "  # Pause the scheduler:"
echo "  gcloud scheduler jobs pause ${SCHEDULER_JOB_NAME} --location=${REGION} --project=${PROJECT_ID}"
echo ""
