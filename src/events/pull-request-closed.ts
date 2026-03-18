import type { PullRequestEvent } from "@octokit/webhooks-types";
import type { Octokit } from "@octokit/rest";
import type { ActionConfig } from "../config/inputs";

export async function handlePullRequestClosed(
  _payload: PullRequestEvent,
  _octokit: Octokit,
  _config: ActionConfig,
): Promise<void> {
  throw new Error("Not implemented");
}
