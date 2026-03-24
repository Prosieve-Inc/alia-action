# Alia Action

AI-powered PR analysis -- code never leaves your runner. By Alia.

## How It Works

Alia triggers on PR lifecycle events (comments, close/merge, push to main), collects PR metadata and comments from the GitHub API, authenticates with a backend to obtain AI credentials, analyzes the PR locally using Claude via Vertex AI, and submits only the resulting insights to the backend. Source code never leaves the GitHub Actions runner -- the backend controls AI access but never sees code. Phase 1 uses mocked downstream steps (auth, analysis, submission) so the action runs end-to-end for verification.

## Trigger Events

| Event                 | Trigger                           | What Happens                                                 |
| --------------------- | --------------------------------- | ------------------------------------------------------------ |
| `issue_comment`       | Any new comment on a PR or issue  | Collects PR/issue metadata and all comments, runs analysis   |
| `pull_request` closed | PR merged or closed without merge | Collects full PR data including merge status, files, commits |
| `push` to main        | Code pushed to the main branch    | Traces push to its source merged PR, collects that PR's data |

## Prerequisites

- GitHub organization (B2B -- org-level App installation)
- [`gh` CLI](https://cli.github.com/) authenticated with org admin access
- Repository with GitHub Actions enabled

## Setup

### 1. Create the GitHub App

```bash
just create-app Prosieve-Inc
# or directly:
./scripts/create-app.sh Alia Prosieve-Inc
```

This opens the GitHub App creation page with the recommended configuration. Set minimal permissions -- the installation token is primarily for backend authentication, not GitHub API access.

See [GitHub Docs: Creating a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app) for details.

### 2. Configure the App

After creating the App:

1. **Generate a private key** -- scroll down on the App settings page and click "Generate a private key"
2. **Install the App** on your organization at `https://github.com/organizations/{org}/settings/installations` -- choose "All repositories" or select specific repos
3. **Note the Installation ID** from the URL after installing (e.g., `https://github.com/settings/installations/12345678` -- the number is the Installation ID)

See [GitHub Docs: Installing GitHub Apps](https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app) for details.

### 3. Store Secrets

Add these secrets to your repository (Settings > Secrets and variables > Actions):

| Secret                 | Description                               |
| ---------------------- | ----------------------------------------- |
| `ALIA_BACKEND_URL`     | Backend API base URL                      |
| `ALIA_AUTH_ROUTE`      | Backend auth endpoint path                |
| `ALIA_INSIGHTS_ROUTE`  | Backend insights submission endpoint path |
| `ALIA_KEY`             | Decryption key for Vertex AI credentials  |
| `ALIA_APP_ID`          | GitHub App ID (from App settings page)    |
| `ALIA_APP_PRIVATE_KEY` | GitHub App private key (PEM format)       |
| `ALIA_INSTALLATION_ID` | GitHub App Installation ID                |

### 4. Add Workflow

Create `.github/workflows/alia.yml` in your repository:

```yaml
name: Alia PR Analysis

on:
  issue_comment:
    types: [created]
  pull_request:
    types: [closed]
  push:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    if: >-
      github.event_name == 'push' ||
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' && github.event.issue)
    steps:
      - uses: actions/checkout@v4

      - name: Run Alia Action
        uses: Prosieve-Inc/alia-action@main
        with:
          backend_url: ${{ secrets.ALIA_BACKEND_URL }}
          auth_route: ${{ secrets.ALIA_AUTH_ROUTE }}
          insights_route: ${{ secrets.ALIA_INSIGHTS_ROUTE }}
          alia_key: ${{ secrets.ALIA_KEY }}
```

## Action Inputs

| Input            | Required | Description                               |
| ---------------- | -------- | ----------------------------------------- |
| `backend_url`    | Yes      | Backend API base URL                      |
| `auth_route`     | Yes      | Backend auth endpoint path                |
| `insights_route` | Yes      | Backend insights submission endpoint path |
| `alia_key`       | Yes      | Decryption key for Vertex AI credentials  |

`GITHUB_TOKEN` is automatically available via `github.token` -- no explicit input needed.

## Testing

After pushing the workflow to your repository:

1. **Push to a branch** -- the CI workflow (`test.yml`) should trigger and pass
2. **Create a PR and add a comment** -- the `issue_comment` trigger fires. Check the Actions tab for `[MOCK]` log lines showing collected metadata
3. **Close or merge the PR** -- the `pull_request` trigger fires. Logs show full PR data including merge status
4. **Push to main** -- the `push` trigger fires. Logs show the merged PR traced from the push commit

In Phase 1, all downstream steps (auth, analysis, submission) are mocked. Look for `[MOCK]` prefixed log lines confirming the pipeline executed end-to-end.

## Development

```bash
just install    # Install dependencies and pre-commit hooks
just test       # Run tests
just typecheck  # TypeScript type checking
just check      # Run all checks (typecheck + format + tests)
just format     # Format code with Prettier
```

Requires [Bun](https://bun.sh/) v1.3.6+ and [just](https://just.systems/).

## Current Status

**Phase 1: Foundation.** The action triggers on all three event types, collects real PR metadata and comments from the GitHub API, and runs a mocked pipeline (auth, analysis, submission). Downstream steps will be implemented in Phase 2 (backend authorization) and Phase 3 (AI analysis and insights submission).
