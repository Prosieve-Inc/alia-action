import { query } from "@anthropic-ai/claude-agent-sdk";
import { log } from "../utils/logger";

export async function handleClaudeTest(): Promise<void> {
  log.info("Running Claude SDK test...");

  const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "ANTHROPIC_VERTEX_PROJECT_ID is not set. Ensure google-github-actions/auth@v2 runs before this action.",
    );
  }

  const sdkOptions = {
    model: "claude-haiku-4-5",
    maxTurns: 1,
    systemPrompt: "You are a helpful assistant. Respond briefly.",
    env: {
      ...(process.env as Record<string, string>),
      CLAUDE_CODE_USE_VERTEX: "1",
      ANTHROPIC_VERTEX_PROJECT_ID: projectId,
      CLOUD_ML_REGION: "global",
    },
  };

  const messages = [];
  for await (const message of query({
    prompt:
      "Say hello and confirm you are running inside a GitHub Action on Vertex AI. Keep it under 30 words.",
    options: sdkOptions,
  })) {
    messages.push(message);
    log.debug(`SDK message: ${JSON.stringify(message)}`);
  }

  log.info(`Claude SDK test complete. Received ${messages.length} messages.`);
}
