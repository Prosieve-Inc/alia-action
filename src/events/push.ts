import type { PushEvent } from "@octokit/webhooks-types";
import type { Octokit } from "@octokit/rest";
import type { ActionConfig } from "../config/inputs";

export async function handlePush(
  _payload: PushEvent,
  _octokit: Octokit,
  _config: ActionConfig,
): Promise<void> {
  throw new Error("Not implemented");
}
