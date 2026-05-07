import type { PushEvent } from "@octokit/webhooks-types";
import type { Octokit } from "@octokit/rest";
import type { ActionConfig } from "../config/inputs";
import type { AliaClient } from "../services/alia-client";
import type { EventContext } from "../github/types";
import { findMergedPR } from "../github/data-fetcher";
import { formatEventContext } from "../github/data-formatter";
import { runClaudeAnalysis } from "./claude-analysis";
import { enrichSummariesWithUserIds } from "./common/enrich-users";
import { log } from "../utils/logger";

export async function handlePush(
  payload: PushEvent,
  octokit: Octokit,
  _config: ActionConfig,
  aliaClient: AliaClient,
): Promise<void> {
  // Only process pushes to main branch
  if (payload.ref !== "refs/heads/main") {
    log.info(`Ignoring push to non-main branch: ${payload.ref}`);
    return;
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const commitSha = payload.after;
  const branch = payload.ref.replace("refs/heads/", "");

  log.info(`Processing push to main: ${commitSha}`);

  // Skip if this push came from a merged PR — handled by pull_request closed event
  const prNumber = await findMergedPR(octokit, owner, repo, commitSha);
  if (prNumber !== null) {
    log.info(
      `Push is from merged PR #${prNumber} — skipping (handled by pull_request event).`,
    );
    return;
  }

  log.info("Standalone push commit. Running analysis...");

  // Build context from push payload commits
  const commits = (payload.commits ?? []).map((c) => ({
    sha: c.id,
    message: c.message,
    author: c.author?.username ?? c.author?.name ?? "unknown",
    date: c.timestamp,
  }));

  const context: EventContext = {
    eventName: "push",
    owner,
    repo,
    comments: [],
    files: [],
    commits,
  };

  log.info(formatEventContext(context));

  const analysis = await runClaudeAnalysis("push", context, aliaClient);
  const enrichedSummaries = await enrichSummariesWithUserIds(
    analysis.summaries,
    octokit,
  );

  await aliaClient.sendInsights(
    {
      event: "push",
      branch,
      commitSha,
      owner,
      repo,
    },
    enrichedSummaries,
  );

  log.info(`push handler complete (commit ${commitSha.slice(0, 7)})`);
}
