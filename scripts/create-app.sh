#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${1:-alia-dev}"
ORG="${2:?Usage: ./scripts/create-app.sh [app-name] <org-name>}"

echo "Creating GitHub App '$APP_NAME' for org '$ORG'..."

gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  "/orgs/$ORG/apps" \
  -f name="$APP_NAME" \
  -f url="https://github.com/$ORG/alia-action" \
  -f description="Alia - AI-powered PR analysis" \
  -F public=false \
  --jq '.id, .slug, .client_id'

echo ""
echo "GitHub App created successfully."
echo ""
echo "Next steps:"
echo "  1. Note the App ID from the output above"
echo "  2. Generate a private key:"
echo "     gh api --method POST /app/installations -H 'Accept: application/vnd.github+json'"
echo "  3. Install the app on your org:"
echo "     Visit https://github.com/organizations/$ORG/settings/installations"
echo "     Select 'All repositories' or specific repos"
echo "  4. Store as GitHub secrets in your repos:"
echo "     - ALIA_APP_ID (the App ID)"
echo "     - ALIA_APP_PRIVATE_KEY (the generated private key)"
echo "     - ALIA_INSTALLATION_ID (from installation URL after install)"
