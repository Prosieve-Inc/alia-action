import type {
  SDKResultSuccess,
  SDKResultError,
} from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as github from "@actions/github";
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
Be thorough but concise in your analysis and by the end always say how much commits could you see.`;

function buildPrompt(): string {
  const eventName = github.context.eventName;
  const payload = github.context.payload;

  if (eventName === "pull_request" || eventName === "pull_request_target") {
    const pr = payload.pull_request;
    const baseRef = pr?.base?.ref ?? "main";
    const prNumber = pr?.number ?? "unknown";
    const prTitle = pr?.title ?? "";

    return `This action was triggered by PR #${prNumber}: "${prTitle}".

Analyze ONLY the changes in this pull request:
1. Run \`git log origin/${baseRef}..HEAD --oneline\` to see the PR commits
2. Run \`git diff origin/${baseRef}..HEAD --stat\` to see which files changed
3. Read the most important changed files to understand what the PR does
4. Provide a summary of: what changed, why (based on commit messages and code), and any observations

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

  const prompt = buildPrompt();

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
