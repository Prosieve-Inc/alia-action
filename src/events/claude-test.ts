import { query } from "@anthropic-ai/claude-agent-sdk";
import type { ActionConfig } from "../config/inputs";
import { log } from "../utils/logger";

export async function handleClaudeTest(config: ActionConfig): Promise<void> {
  log.info("Running Claude SDK test...");

  const sdkOptions = {
    model: "claude-sonnet-4-20250514",
    maxTurns: 1,
    systemPrompt: "You are a helpful assistant. Respond briefly.",
    env: {
      ...(process.env as Record<string, string>),
      CLAUDE_CODE_USE_VERTEX: "1",
      ANTHROPIC_VERTEX_PROJECT_ID: config.vertexProjectId,
      CLOUD_ML_REGION: config.vertexRegion,
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
