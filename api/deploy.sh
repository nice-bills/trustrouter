#!/bin/bash
set -e

# Change to the api/ directory so we deploy the backend server, NOT the project root CLI
cd "$(dirname "$0")"

REGION="us-central1"

echo "Deploying API to Cloud Run Service natively from source..."
gcloud run deploy trustrouter-api \
  --source . \
  --allow-unauthenticated \
  --clear-base-image \
  --region $REGION \
  --port 8080

echo "Deploying Indexer to Cloud Run Job using the built image..."
IMAGE=$(gcloud run services describe trustrouter-api --region $REGION --format="value(image)")

gcloud run jobs create trustrouter-indexer \
  --image $IMAGE \
  --command "npm,run,indexer" \
  --max-retries=0 \
  --task-timeout=3600s \
  --region $REGION || \
gcloud run jobs update trustrouter-indexer \
  --image $IMAGE \
  --max-retries=0 \
  --task-timeout=3600s \
  --region $REGION

echo "Deployment complete!"
