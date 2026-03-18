#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${1:-alia-dev}"
ORG="${2:?Usage: ./scripts/create-app.sh [app-name] <org-name>}"

MANIFEST=$(cat <<EOF
{
  "name": "$APP_NAME",
  "url": "https://github.com/$ORG/alia-action",
  "description": "Alia - AI-powered PR analysis",
  "public": false,
  "default_permissions": {
    "contents": "read",
    "issues": "write",
    "pull_requests": "write",
    "metadata": "read"
  },
  "default_events": [
    "issue_comment",
    "pull_request",
    "push"
  ]
}
EOF
)

echo "Creating GitHub App '$APP_NAME' for org '$ORG'..."
echo ""
echo "Opening GitHub App creation page in your browser..."
echo ""
echo "The app manifest has been prepared with these settings:"
echo "  - Name: $APP_NAME"
echo "  - Permissions: contents(read), issues(write), pull_requests(write), metadata(read)"
echo "  - Events: issue_comment, pull_request, push"
echo ""

# GitHub doesn't support direct API creation of Apps.
# Open the web UI for manual creation.
URL="https://github.com/organizations/$ORG/settings/apps/new"

if command -v open &>/dev/null; then
  open "$URL"
elif command -v xdg-open &>/dev/null; then
  xdg-open "$URL"
else
  echo "Open this URL in your browser:"
  echo "  $URL"
fi

echo ""
echo "Configure the app with these settings:"
echo ""
echo "  Homepage URL: https://github.com/$ORG/alia-action"
echo "  Webhook: Uncheck 'Active' (not needed for Phase 1)"
echo ""
echo "  Repository permissions:"
echo "    - Contents: Read-only"
echo "    - Issues: Read & write"
echo "    - Pull requests: Read & write"
echo "    - Metadata: Read-only"
echo ""
echo "  Subscribe to events:"
echo "    - Issue comment"
echo "    - Pull request"
echo "    - Push"
echo ""
echo "  Where can this app be installed? → Only on this account"
echo ""
echo "After creating:"
echo "  1. Note the App ID from the app settings page"
echo "  2. Generate a private key (scroll down on the app settings page)"
echo "  3. Install the app: https://github.com/organizations/$ORG/settings/installations"
echo "  4. Note the Installation ID from the URL after installing"
echo "  5. Store as GitHub secrets in your repo:"
echo "     - ALIA_APP_ID"
echo "     - ALIA_APP_PRIVATE_KEY"
echo "     - ALIA_INSTALLATION_ID"
