import type { Octokit } from "@octokit/rest";
import type { ActionConfig } from "../config/inputs";

export async function routeEvent(
  _octokit: Octokit,
  _config: ActionConfig,
): Promise<void> {
  throw new Error("Not implemented");
}
