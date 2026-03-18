import type { PullRequestEvent } from "@octokit/webhooks-types";
import type { Octokit } from "@octokit/rest";
import type { ActionConfig } from "../config/inputs";
import type { EventContext } from "../github/types";
import {
  fetchPullRequestData,
  fetchComments,
  fetchFiles,
  fetchCommits,
} from "../github/data-fetcher";
import { formatEventContext } from "../github/data-formatter";
import { mockAuth } from "../mocks/auth";
import { mockAnalysis } from "../mocks/analysis";
import { mockSubmission } from "../mocks/submission";
import { log } from "../utils/logger";

export async function handlePullRequestClosed(
  payload: PullRequestEvent,
  octokit: Octokit,
  config: ActionConfig,
): Promise<void> {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const prNumber = payload.pull_request.number;

  log.info(
    `Processing pull_request closed event for #${prNumber} (merged: ${payload.pull_request.merged})`,
  );

  const [pullRequest, files, commits, comments] = await Promise.all([
    fetchPullRequestData(octokit, owner, repo, prNumber),
    fetchFiles(octokit, owner, repo, prNumber),
    fetchCommits(octokit, owner, repo, prNumber),
    fetchComments(octokit, owner, repo, prNumber, true),
  ]);

  const context: EventContext = {
    eventName: "pull_request",
    owner,
    repo,
    pullRequest,
    comments,
    files,
    commits,
  };

  log.info(formatEventContext(context));

  // Run mock pipeline
  const authResult = await mockAuth(
    config.backendUrl,
    config.authRoute,
    config.githubToken,
  );
  const analysisResult = await mockAnalysis(context);
  await mockSubmission(
    config.backendUrl,
    config.insightsRoute,
    analysisResult,
    {
      owner,
      repo,
      prNumber,
      commitSha: payload.pull_request.merge_commit_sha ?? undefined,
    },
  );

  log.info(
    `pull_request handler complete (merged: ${pullRequest.merged}, authorized: ${authResult.authorized})`,
  );
}
