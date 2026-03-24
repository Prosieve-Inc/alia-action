import type {
  SDKResultSuccess,
  SDKResultError,
} from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
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

const USER_PROMPT = `Analyze this repository and provide a brief summary covering:
1. What this project does (look at README, package.json, or similar)
2. The main technologies and frameworks used
3. The high-level directory structure
4. Recent git activity (last 5 commits with authors)

Use the available tools to read files and run git commands. Keep your final summary under 300 words.`;

export async function handleClaudeTest(): Promise<void> {
  log.info("Running Claude SDK agent test...");

  const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "ANTHROPIC_VERTEX_PROJECT_ID is not set. Ensure google-github-actions/auth@v2 runs before this action.",
    );
  }

  const cwd = process.env.GITHUB_WORKSPACE || process.cwd();
  log.info(`Working directory: ${cwd}`);

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
    prompt: USER_PROMPT,
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
