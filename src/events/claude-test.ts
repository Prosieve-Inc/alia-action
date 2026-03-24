import type {
  SDKResultSuccess,
  SDKResultError,
} from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as github from "@actions/github";
import { createOctokitClient } from "../github/client";
import {
  fetchPullRequestData,
  fetchComments,
  fetchFiles,
  fetchCommits,
  findMergedPR,
} from "../github/data-fetcher";
import type { EventContext } from "../github/types";
import { log } from "../utils/logger";

/** Tools auto-approved without permission prompts (read-only). */
const ALLOWED_TOOLS: string[] = [
  // Built-in file-reading tools
  "Glob",
  "Grep",
  "LS",
  "Read",
  // Git read commands via Bash
  "Bash(git log:*)",
  "Bash(git diff:*)",
  "Bash(git status:*)",
  "Bash(git show:*)",
  "Bash(git blame:*)",
  "Bash(git branch:*)",
  // RTK-wrapped equivalents (hook rewrites transparently,
  // but if Claude invokes rtk directly we still allow it)
  "Bash(rtk:*)",
];

const SYSTEM_PROMPT = `You are a senior software engineer analyzing a GitHub repository.
You have access to the full repository checkout. Use the available tools (Read, Glob, Grep, LS, and git commands via Bash) to explore the codebase.
Be thorough but concise in your analysis.`;

async function fetchPRContext(): Promise<EventContext | null> {
  const eventName = github.context.eventName;
  if (eventName !== "pull_request" && eventName !== "pull_request_target") {
    return null;
  }

  const prNumber = github.context.payload.pull_request?.number;
  if (!prNumber) return null;

  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  const { owner, repo } = github.context.repo;
  const octokit = createOctokitClient(token);

  log.info(`Fetching PR #${prNumber} context from GitHub API...`);

  const [pullRequest, comments, files, commits] = await Promise.all([
    fetchPullRequestData(octokit, owner, repo, prNumber),
    fetchComments(octokit, owner, repo, prNumber, true),
    fetchFiles(octokit, owner, repo, prNumber),
    fetchCommits(octokit, owner, repo, prNumber),
  ]);

  log.info(
    `PR context: ${files.length} files, ${commits.length} commits, ${comments.length} comments`,
  );

  return {
    eventName,
    owner,
    repo,
    pullRequest,
    comments,
    files,
    commits,
  };
}

function formatPRContext(ctx: EventContext): string {
  const lines: string[] = [];
  const pr = ctx.pullRequest;

  if (pr) {
    lines.push(`## Pull Request #${pr.number}: ${pr.title}`);
    lines.push(`- **Author:** ${pr.author}`);
    lines.push(`- **Branches:** ${pr.headBranch} → ${pr.baseBranch}`);
    lines.push(`- **Status:** ${pr.merged ? "merged" : "open"}`);
    if (pr.mergedAt) lines.push(`- **Merged at:** ${pr.mergedAt}`);
    if (pr.labels.length > 0)
      lines.push(`- **Labels:** ${pr.labels.join(", ")}`);
    lines.push(`- **URL:** ${pr.url}`);
    if (pr.body) {
      lines.push("");
      lines.push("### Description");
      lines.push(pr.body);
    }
  }

  if (ctx.commits.length > 0) {
    lines.push("");
    lines.push("### Commits");
    for (const c of ctx.commits) {
      lines.push(`- \`${c.sha.slice(0, 7)}\` ${c.message} (${c.author})`);
    }
  }

  if (ctx.files.length > 0) {
    lines.push("");
    lines.push("### Changed Files");
    for (const f of ctx.files) {
      lines.push(
        `- ${f.status} \`${f.filename}\` (+${f.additions}/-${f.deletions})`,
      );
    }
  }

  if (ctx.comments.length > 0) {
    lines.push("");
    lines.push("### Comments");
    for (const c of ctx.comments) {
      lines.push(`- **${c.author}** (${c.type}, ${c.createdAt}):`);
      lines.push(`  ${c.body}`);
    }
  }

  return lines.join("\n");
}

function buildPrompt(prContext: EventContext | null): string {
  const eventName = github.context.eventName;
  const payload = github.context.payload;

  if (
    (eventName === "pull_request" || eventName === "pull_request_target") &&
    prContext
  ) {
    const pr = payload.pull_request;
    const baseRef = pr?.base?.ref ?? "main";
    const isMergedOrClosed = payload.action === "closed";
    const action = pr?.merged
      ? "merged"
      : ((payload.action as string | undefined) ?? "updated");

    const context = formatPRContext(prContext);

    if (isMergedOrClosed) {
      // After merge/close, the local checkout may not reflect the PR branch.
      // Rely on the API-fetched context which has all commits, files, and comments.
      return `This action was triggered by a PR being ${action}.

Here is the full PR context fetched from the GitHub API (commits, files, comments):

${context}

The PR has been ${action}, so the local git checkout is on the base branch (\`${baseRef}\`).
Do NOT use \`git log origin/${baseRef}..HEAD\` — it won't show PR commits. All commit and file data is provided above.

Analyze this pull request:
1. Use the commits, changed files, and diffs listed above as your primary source
2. Use Read/Glob/Grep to inspect the current state of key changed files in the repo
3. Consider the PR comments and review feedback above
4. Provide a summary of: what changed, why (based on description, commits, and code), the review discussion, and any observations

Keep your final summary under 300 words.`;
    }

    // Open PR — local checkout has the PR branch, git commands work
    return `This action was triggered by a PR being ${action}.

Here is the full PR context fetched from the GitHub API:

${context}

Now analyze the code changes in this pull request:
1. Run \`git log origin/${baseRef}..HEAD --oneline\` to verify the commits
2. Read the most important changed files to understand what the PR does
3. Consider the PR comments and review feedback above
4. Provide a summary of: what changed, why (based on description, commits, and code), the review discussion, and any observations

Keep your final summary under 300 words.`;
  }

  if (eventName === "push") {
    const beforeSha = (payload.before as string | undefined)?.slice(0, 7) ?? "";
    const afterSha = (payload.after as string | undefined)?.slice(0, 7) ?? "";
    const ref = payload.ref as string | undefined;
    const branch = ref?.replace("refs/heads/", "") ?? "unknown";

    return `This action was triggered by a push to \`${branch}\`.

Analyze ONLY the pushed commits:
1. Run \`git log ${beforeSha}..${afterSha} --oneline\` to see the pushed commits
2. Run \`git diff ${beforeSha}..${afterSha} --stat\` to see which files changed
3. Read the most important changed files to understand what was pushed
4. Provide a summary of: what changed, who authored it, and any observations

Keep your final summary under 300 words.`;
  }

  // workflow_dispatch or any other trigger — full repo analysis
  return `This action was triggered manually.

Analyze this repository with full git history available:
1. What this project does (look at README, package.json, or similar)
2. The main technologies and frameworks used
3. The high-level directory structure
4. Recent git activity (last 20 commits with authors): run \`git log --oneline -20\`
5. Key contributors and branching patterns

Use the available tools to read files and run git commands. Keep your final summary under 300 words.`;
}

export async function handleClaudeTest(): Promise<void> {
  log.info("Running Claude SDK agent test...");

  const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "ANTHROPIC_VERTEX_PROJECT_ID is not set. Ensure google-github-actions/auth@v2 runs before this action.",
    );
  }

  const cwd = process.env.GITHUB_WORKSPACE || process.cwd();
  const eventName = github.context.eventName;
  log.info(`Working directory: ${cwd}`);
  log.info(`Event: ${eventName}`);

  // Skip push events that came from a merged PR — the pull_request event handles those
  if (eventName === "push") {
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      const octokit = createOctokitClient(token);
      const { owner, repo } = github.context.repo;
      const mergedPR = await findMergedPR(
        octokit,
        owner,
        repo,
        github.context.sha,
      );
      if (mergedPR) {
        log.info(
          `Push is from merged PR #${mergedPR} — skipping (handled by pull_request event).`,
        );
        return;
      }
    }
  }

  const prContext = await fetchPRContext();
  const prompt = buildPrompt(prContext);

  const sdkOptions = {
    model: "claude-haiku-4-5",
    maxTurns: 10,
    allowedTools: ALLOWED_TOOLS,
    permissionMode: "bypassPermissions" as const,
    allowDangerouslySkipPermissions: true,
    systemPrompt: SYSTEM_PROMPT,
    cwd,
    env: {
      ...(process.env as Record<string, string>),
      CLAUDE_CODE_USE_VERTEX: "1",
      ANTHROPIC_VERTEX_PROJECT_ID: projectId,
      CLOUD_ML_REGION: "global",
    },
  };

  let resultMessage: SDKResultSuccess | SDKResultError | undefined;

  for await (const message of query({
    prompt,
    options: sdkOptions,
  })) {
    log.debug(`SDK message type: ${message.type}`);

    if (message.type === "result") {
      resultMessage = message as SDKResultSuccess | SDKResultError;
    }
  }

  if (!resultMessage) {
    throw new Error("No result message received from Claude SDK.");
  }

  logResult(resultMessage);
}

function logResult(result: SDKResultSuccess | SDKResultError): void {
  log.info(`Turns: ${result.num_turns}`);
  log.info(`Duration: ${(result.duration_ms / 1000).toFixed(1)}s`);
  log.info(`Cost: $${result.total_cost_usd.toFixed(4)}`);

  if (result.subtype === "success") {
    log.info("--- Claude Response ---");
    log.info(result.result);
    log.info("--- End Response ---");
  } else {
    const errorResult = result as SDKResultError;
    log.error(`Claude SDK error: ${errorResult.subtype}`);
    for (const err of errorResult.errors) {
      log.error(`  ${err}`);
    }
    throw new Error(
      `Claude SDK finished with error: ${errorResult.subtype} - ${errorResult.errors.join("; ")}`,
    );
  }
}
