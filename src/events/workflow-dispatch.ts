import * as github from "@actions/github";
import type { Octokit } from "@octokit/rest";
import type { ActionConfig } from "../config/inputs";
import type { AliaClient } from "../services/alia-client";
import type { EventContext } from "../github/types";
import { runClaudeAnalysis } from "./claude-analysis";
import { enrichSummariesWithUserIds } from "./common/enrich-users";
import { log } from "../utils/logger";

export async function handleWorkflowDispatch(
  octokit: Octokit,
  _config: ActionConfig,
  aliaClient: AliaClient,
): Promise<void> {
  const { owner, repo } = github.context.repo;
  const branch = github.context.ref?.replace("refs/heads/", "") ?? "unknown";

  log.info(`Processing workflow_dispatch for ${owner}/${repo}`);

  const context: EventContext = {
    eventName: "workflow_dispatch",
    owner,
    repo,
    comments: [],
    files: [],
    commits: [],
  };

  const analysis = await runClaudeAnalysis("dispatch", context, aliaClient);
  const enrichedSummaries = await enrichSummariesWithUserIds(
    analysis.summaries,
    octokit,
  );

  await aliaClient.sendInsights(
    {
      event: "workflow_dispatch",
      owner,
      repo,
      branch,
    },
    enrichedSummaries,
  );

  log.info("workflow_dispatch handler complete");
}
